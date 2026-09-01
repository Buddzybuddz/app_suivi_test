# Règles et Standards du Projet (App_Suivi_Test)

Ce fichier `agent.md` définit les règles d'architecture, les frameworks et les standards de code en vigueur sur le projet, à destination des agents IA.

## 1. Architecture

Le projet est construit selon une architecture **Serverless / BaaS (Backend-as-a-Service)** couplée à une **Single Page Application (SPA)** pour le front-end.

- **Front-end :** Vanilla HTML, CSS, JavaScript (`index.html`, `styles.css`, `utils.js`, dossier `js/`). Aucun framework front-end lourd (React, Vue, Angular) n'est utilisé. Aucun bundler (Webpack, Vite) n'est présent.
- **Back-end :** Le projet s'appuie exclusivement sur **Appwrite** Cloud (`https://fra.cloud.appwrite.io/v1`). La logique métier de persistance et de requêtage des bases de données est directement gérée côté client via le SDK Appwrite (`appwrite_config.js`). (Note : Le projet utilisait potentiellement PocketBase par le passé, mais a migré vers Appwrite).
- **Authentification :** `js/auth.js` — `bootstrap()` vérifie la session Appwrite (`account.get()`) **avant** d'appeler `init()`. Sans session : l'écran `#loginScreen` est affiché et `.app-container` reste `hidden`. La session (cookie + fallback `localStorage.cookieFallback`) dure ~1 an. Les permissions des collections doivent être réglées sur le rôle `Users` (voir README, section « Configuration Appwrite »).
- **Organisation du JS :** L'ancien `app.js` monolithique a été scindé en fichiers thématiques dans `js/`, chargés en **scope global classique** (pas de modules ES) dans un ordre significatif défini par `index.html` : `state.js` (Store + Appwrite), `table-tools.js` (tri/filtre/resize), `dom.js` (cache DOM), `init.js` (persistance sélection + init), `views-forms.js` (vues, selects, modales, dates), `events.js` (listeners + mutations tickets), `render-tables.js`, `render-tickets.js`, `calc-dates.js` (jours ouvrés / fériés FR), `dashboard.js` (KPIs + graphiques + `updateUI`). Les handlers appelés depuis le HTML inline restent exposés via `window.*`.
- **Logique Métier :** Les fonctions pures (calculs de charge, formatage) sont dans `utils.js` (testé). Les calculs de charge (Jours de Conception/Exécution, RAF) sont effectués à la volée côté client (`getCalculations`).

## 2. Frameworks de Tests

- **Environnement de développement :** Le projet de production reste en Vanilla JS sans bundler. Cependant, un environnement Node.js local (via `package.json`) est mis en place **exclusivement** pour l'exécution des tests.
- **Framework de tests unitaires :** Le projet utilise **Vitest**. Les fichiers de tests sont nommés `*.test.js` et placés à côté du fichier testé (`utils.test.js`, `js/calc-dates.test.js`).
- **Testabilité et Architecture :** La logique métier pure doit être découplée du DOM et exportable. Les fonctions pures vivent dans `utils.js` (`round015Up`, `formatFrenchFloat`, `getCalculations`, `computeThresholds`, `deriveStatusesOnConsumed`, `escapeHtml`) et `js/calc-dates.js` (`getFrenchHolidays`, `addWorkingDays`, `getWorkingDaysPrecise`) — via un garde `if (typeof module !== 'undefined' && module.exports)` inerte dans le navigateur.
- **Règle d'or de développement :** Toute nouvelle logique métier pure doit être livrée avec son test. Après toute modification : `npm run lint`, `npm run format:check` et `npm test` doivent passer (c'est ce que vérifie la CI).
- **Outillage :** ESLint (flat config `eslint.config.js`) + Prettier (`.prettierrc.json`, 4 espaces, quotes simples). `no-undef` / `no-unused-vars` sont désactivés sur `js/**` car ces fichiers partagent un scope global implicite.

## 3. Standards de Code

- **Vanilla JS (ES6+) :** Utilisation intensive de fonctionnalités modernes (Destructuring, Promises, `async/await`, Arrow functions).
- **Gestion de l'État (State Management) :**
    - Utilisation d'un objet global `Store` (dans `js/state.js`) contenant les collections (users, projects, versions, tickets) ainsi que l'état de l'interface (tri, filtres, largeurs de colonnes).
    - Persistance de l'état de l'interface utilisateur (Client, Projet, Version sélectionnés) via `localStorage` (ex: `TestTracker_Client`).
    - Un flag `DEBUG` (activable via `?debug` dans l'URL) et le helper `debug()` conditionnent tous les logs de debug.
- **Manipulation du DOM :**
    - Approche déclarative manuelle via un objet `DOM` rafraîchi par `refreshDOM()`.
    - Rendu et mise à jour de l'interface gérés par des fonctions dédiées (ex: `updateUI()`, `renderProjectsTable()`).
- **Design & UI :**
    - Utilisation de la bibliothèque d'icônes `lucide` (`lucide.createIcons()`).
    - L'interface suit des standards Vanilla CSS (définis dans `styles.css`).
- **Logique de Calculs Spécifique :**
    - Les arrondis métier doivent utiliser les fonctions dédiées `round015Up` (multiple de 0.15) et `round05Up` (multiple de 0.5).
    - L'affichage des flottants doit respecter le formatage français avec virgule via `formatFrenchFloat`.
- **Sécurité du rendu :**
    - Toute donnée dynamique interpolée dans un template `innerHTML` **doit** passer par `escapeHtml()` (défini dans `utils.js`). Ne jamais injecter de valeur utilisateur brute.
- **Édition du code :**
    - Éditer directement les fichiers de `js/`. Le dossier `scratch/` et ses scripts Python de "patch" ont été supprimés — ils n'ont plus lieu d'être depuis le découpage.

## 4. Catalogue de Compétences (Skills)

Pour exécuter des tâches complexes, tu as accès à une bibliothèque de compétences locales.
**Chemin absolu de la bibliothèque :** `/Users/JeremyBaudouin/Library/Application Support/Antigravity/skills`

**Règle de routage :**

- Avant de tenter d'écrire un script complexe de zéro (par exemple pour une analyse de données, un déploiement ou un test de charge), tu **dois obligatoirement** lister le contenu de ce dossier.
- Si le nom d'un sous-dossier ou d'un fichier `SKILL.md` correspond à l'intention de la tâche demandée, tu dois charger et suivre les instructions de cette compétence spécifique avant de poursuivre.

**Auto-amélioration et Création de Compétences :**
Si tu dois accomplir une tâche complexe et récurrente, mais qu'aucune compétence existante dans le répertoire source ne correspond à ce besoin, tu as l'autorisation de créer une nouvelle compétence :

1. **Fait appel au Skill Smith :** Utilise en priorité la compétence `10-andruia-skill-smith` si elle est disponible pour t'aider à structurer le nouvel outil.
2. **Création du dossier :** Crée un nouveau dossier avec un nom clair (sans espaces, séparé par des tirets) dans `/Users/JeremyBaudouin/Library/Application Support/Antigravity/skills/`.
3. **Rédaction du contrat :** Rédige obligatoirement un fichier `SKILL.md` à la racine de ce nouveau dossier. Il doit contenir un titre, un "Trigger" très explicite, et les instructions de fonctionnement.
4. **Développement :** Crée les scripts utilitaires (Python, JS, Node, etc.) nécessaires à l'intérieur de ce même dossier.
5. **Exécution :** Une fois la compétence créée, charge-la et utilise-la pour terminer la tâche initiale sur `App_Suivi_Test`.
