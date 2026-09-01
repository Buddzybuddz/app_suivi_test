# Identité Visuelle et Design System (App_Suivi_Test)

Ce fichier `design.md` fige l'identité visuelle, la palette de couleurs, l'utilisation des frameworks et les comportements d'interface (UI/UX) pour le projet.

## 1. Framework CSS

Le projet n'utilise **aucun framework CSS externe** (ni TailwindCSS, ni Bootstrap).
Il s'agit d'un système de style 100% **Vanilla CSS** basé sur des variables natives (`:root`) et orienté composants via des classes standards (BEM-like simplifié).

## 2. Palette de Couleurs (Variables CSS)

La palette repose sur des nuances professionnelles et modernes (inspirées de la gamme "Slate", "Indigo" et "Sky" de Tailwind).

### Fondations

- `--bg-app` : `#f1f5f9` (Slate 50) - Fond principal de l'application.
- `--bg-sidebar` : `#0f172a` (Slate 900) - Fond de la barre de navigation latérale.
- `--bg-card` : `#ffffff` - Fond des conteneurs, tableaux et modales.

### Textes

- `--text-main` : `#0f172a` - Texte principal.
- `--text-muted` : `#64748b` - Texte secondaire, labels de formulaires, en-têtes de tableaux.
- `--text-inverse` : `#ffffff` - Texte sur fonds foncés (sidebar, boutons primaires).

### Couleurs d'Accentuation

- `--accent-primary` : `#4f46e5` (Indigo 600) - Actions principales, éléments actifs, focus.
- `--accent-secondary` : `#0ea5e9` (Sky 500) - Éléments décoratifs et icônes.

### Couleurs Sémantiques (Statuts)

- `--success` : `#10b981` (Terminé, OK)
- `--warning` : `#f59e0b` (Bloqué, Attention)
- `--danger` : `#ef4444` (Erreur, KO, Retard)

### Dégradés (KPIs & Progress Bars)

Des dégradés spécifiques sont utilisés pour différencier visuellement les métriques :

- Orange : `linear-gradient(135deg, #f59e0b, #f97316)` (Conception)
- Violet : `linear-gradient(135deg, #6366f1, #8b5cf6)` (Exécution)
- Rose : `linear-gradient(135deg, #8b5cf6, #ec4899)` (Total)
- Teal : `linear-gradient(135deg, #14b8a6, #10b981)` (Validations)

## 3. Typographie

- **Police Principale :** `Inter`, sans-serif.
- Tailles : Utilisation prédominante de valeurs en `rem`. Les textes secondaires et en-têtes de colonnes ont des tailles réduites (`0.75rem`, `0.7rem`) pour la densité des données.
- Poids : `500` (Medium) pour les éléments d'interface basiques, `600` (Semibold) pour les labels/boutons, et `800` (Extrabold) pour les titres principaux et compteurs KPI.

## 4. Comportement des Composants & Esthétique

### Cartes et KPIs (Glassmorphism)

- Les cartes (`.kpi-card`, `.chart-card`) exploitent le **Glassmorphism** : fond blanc translucide (`rgba(255, 255, 255, 0.7)`), filtre de flou (`backdrop-filter: blur(15px) saturate(150%)`).
- Angles fortement arrondis (`border-radius: 20px`).
- **Micro-interactions :** Au survol, les cartes se soulèvent (`translateY(-5px)`), l'opacité du fond augmente (`0.85`) et l'ombre portée (`box-shadow`) s'intensifie.

### Tableaux de Données (`.data-table`)

- Optimisés pour le défilement horizontal avec des largeurs adaptatives et des colonnes redimensionnables manuellement (`.resizer`).
- **Sticky headers :** Les premières colonnes (gauche) sont fixées avec `position: sticky`, z-index superposés et une ombre séparatrice légère.
- **Bords et espacements :** Bordures très fines (`var(--border-light)`), en-têtes en majuscules (uppercase) et espacement (letter-spacing).

### Formulaires et Édition en ligne (Inline Edit)

- Les champs dans les tableaux (`.editable-field`, `.status-select`) possèdent un style distinctif au repos : fond très légèrement coloré (`rgba(79, 70, 229, 0.04)`) et bordure inférieure hachurée (dashed) pour suggérer l'édition.
- Au focus / survol : Le fond devient plein, la bordure passe au style `solid` et prend la couleur d'accentuation principale avec un léger halo lumineux (`box-shadow` rgba).

### Boutons (`.btn`)

- Coins arrondis `8px`.
- Boutons primaires (`.btn-primary`) utilisant `--accent-primary`.
- **Micro-interactions :** Translation de `-1px` vers le haut au survol pour dynamiser l'interface.

### Modales (`.modal`)

- Arrière-plan assombri et légèrement flouté (backdrop-filter).
- Conteneurs arrondis (`16px`), sans dégrader l'expérience globale en restant limités en largeur max.

### Scrollbars

- Scrollbars Webkit personnalisées (très fines, `6px`, avec un "thumb" de couleur `slate-300` / `#cbd5e1` passant à `slate-400` / `#94a3b8` au survol).

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
