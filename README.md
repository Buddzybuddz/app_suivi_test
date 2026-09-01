# App_Suivi_Test — Suivi de recette de tests

Application web mono-utilisateur pour piloter la recette de tests par **projet → version → ticket** :
saisie des tickets, calcul automatique de la charge (jours-homme de conception / exécution),
reste-à-faire (RAF), transitions de statut, et tableau de bord (KPIs, graphiques, analyse du
risque de livraison).

## Stack

- **Front-end :** HTML/CSS/JS vanilla, sans framework ni bundler.
  Le JS est découpé en fichiers thématiques dans `js/`, chargés en scope global classique
  dans l'ordre défini par `index.html`. La logique pure et testable est isolée dans `utils.js`
  et `js/calc-dates.js`.
- **Back-end :** [Appwrite Cloud](https://appwrite.io) (`https://fra.cloud.appwrite.io/v1`),
  interrogé directement depuis le navigateur via le SDK. Config dans `appwrite_config.js`.
- **Auth :** session Appwrite email/mot de passe (`js/auth.js`). L'app exige une session
  avant de charger quoi que ce soit ; la session dure ~1 an (login demandé une fois par
  navigateur). Bouton « Déconnexion » en bas de la sidebar.
- **Libs CDN :** Chart.js, Lucide, html2canvas, SDK Appwrite — versions épinglées + hash
  Subresource Integrity dans `index.html`.
- **Durcissement :** en-tête `Content-Security-Policy` (`<meta>`) limitant `connect-src` à
  Appwrite, bloquant `object-src` / `base-uri`. `script-src` garde `'unsafe-inline'` (handlers
  `onclick=` inline).

## Démarrer en local

```bash
npm install
npm run serve      # sert le dossier sur http://localhost:8000
```

Ouvrir <http://localhost:8000/> et se connecter. Ajouter `?debug` à l'URL pour les logs console.

Aucune variable d'environnement : le projet Appwrite est référencé en clair dans
`appwrite_config.js` (identifiants publics côté client — la sécurité tient aux permissions
des collections, voir ci-dessous).

## Configuration Appwrite (à faire une fois, côté console)

Pour que l'authentification protège réellement les données :

1. **Auth → Settings** : désactiver l'inscription libre (« Users signup »).
2. **Auth → Users** : créer le(s) compte(s) autorisé(s) (email + mot de passe).
3. Pour chacune des 4 collections (`users`, `projects`, `versions`, `tickets`) :
    - **Settings → Permissions** : retirer le rôle `Any`, ajouter le rôle `Users` avec
      `Create` / `Read` / `Update` / `Delete`.
    - Laisser « Document Security » désactivé.

Sans l'étape 3, les collections restent lisibles/modifiables sans être connecté.

## Scripts npm

| Commande               | Effet                                  |
| ---------------------- | -------------------------------------- |
| `npm test`             | Tests unitaires (Vitest, une passe)    |
| `npm run test:watch`   | Tests en mode watch                    |
| `npm run lint`         | ESLint sur tout le repo                |
| `npm run format`       | Prettier (réécriture)                  |
| `npm run format:check` | Prettier (vérification, utilisé en CI) |
| `npm run serve`        | Serveur statique local (port 8000)     |

La CI GitHub Actions (`.github/workflows/ci.yml`) lance lint + format:check + tests à chaque
push sur `main` et sur chaque pull request.

## Logique de calcul

Fonctions pures dans `utils.js` :

- `round015Up(v)` / `round05Up(v)` — arrondi métier au multiple de 0,15 / 0,5 supérieur.
- `formatFrenchFloat(v)` — affichage `1,50` (virgule, 2 décimales).
- `computeThresholds(ticket, project)` — seuils de charge :
  `jC = round015Up(nbTestCases / designRatio)`, `jE = round015Up(nbTestCases / executionRatio)`.
- `deriveStatusesOnConsumed(consumed, jC, jE)` — déduit `statusDesign` / `statusExecution`
  du consommé (on consomme d'abord la conception, puis l'exécution).
- `getCalculations(ticket, project)` — RAF par phase et global.

Calendrier ouvré dans `js/calc-dates.js` : `getFrenchHolidays(year)` (fériés fixes + Pâques via
Meeus), `addWorkingDays`, `getWorkingDaysPrecise`.

## Modèle de données (collections Appwrite)

| Collection | Champs principaux                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`    | `name`, `role`                                                                                                                                                                      |
| `projects` | `client`, `name`, `ticketStates[]`, `userIds[]`, `designRatio`, `executionRatio`                                                                                                    |
| `versions` | `projectId`, `name`, `deliveryDateClient`, `deliveryDateActual`                                                                                                                     |
| `tickets`  | `versionId`, `feature`, `type`, `number`, `priority`, `assignDesignId`, `assignExecutionId`, `nbTestCases`, `ticketState`, `consumed`, `statusDesign`, `statusExecution`, `comment` |

## Conventions

- Toute donnée dynamique injectée dans du HTML passe par `escapeHtml()` (`utils.js`).
- Toute nouvelle logique métier pure est ajoutée à `utils.js` (ou `js/calc-dates.js`) **avec
  son test**.
- Feedback utilisateur via `notify(message, type)` (toasts) — pas de `alert()`.
- Voir `agent.md` (règles projet) et `design.md` (identité visuelle).
