// state.js — Etat global, Store et chargement Appwrite
// (extrait de l'ancien app.js, chargement en scope global classique)

// Initialize Icons
lucide.createIcons();

// Logs de debug : activer en passant DEBUG à true (ou via ?debug dans l'URL).
const DEBUG = /[?&]debug\b/.test(location.search);
const debug = (...args) => {
    if (DEBUG) console.log(...args);
};

// --- Data Models and Persistence (Appwrite) ---

// Plafond de documents récupérés par collection (limite dure de listDocuments).
const STORE_FETCH_LIMIT = 5000;

const Store = {
    users: [],
    projects: [],
    versions: [],
    tickets: [],
    sortOptions: {
        tickets: { key: 'feature', dir: 'asc' },
        projects: { key: 'name', dir: 'asc' },
        versions: { key: 'name', dir: 'asc' },
        users: { key: 'name', dir: 'asc' }
    },
    columnWidths: { tickets: {}, projects: {}, versions: {}, users: {} },
    filters: { tickets: {}, projects: {}, versions: {}, users: {} }
};

async function loadStore() {
    // Verrou de sécurité : Force la connexion au Cloud Appwrite et ignore toute simulation
    if (typeof client !== 'undefined') window.databases = new Appwrite.Databases(client);

    try {
        const [users, projects, versions, tickets] = await Promise.all([
            databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [
                Query.limit(STORE_FETCH_LIMIT)
            ]),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
                Query.limit(STORE_FETCH_LIMIT)
            ]),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.VERSIONS, [
                Query.limit(STORE_FETCH_LIMIT)
            ]),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
                Query.limit(STORE_FETCH_LIMIT)
            ])
        ]);

        Store.users = users.documents.map((d) => ({ id: d.$id, ...d }));
        Store.projects = projects.documents.map((d) => ({ id: d.$id, ...d }));
        Store.versions = versions.documents.map((d) => ({ id: d.$id, ...d }));
        Store.tickets = tickets.documents.map((d) => ({ id: d.$id, ...d }));

        // Alerte si une collection dépasse le plafond : le Store serait incomplet.
        [
            ['utilisateurs', users],
            ['projets', projects],
            ['versions', versions],
            ['tickets', tickets]
        ].forEach(([label, res]) => {
            if (res.total > res.documents.length) {
                console.warn(
                    `loadStore: ${res.documents.length}/${res.total} ${label} chargés (plafond ${STORE_FETCH_LIMIT}). Données incomplètes.`
                );
                if (typeof notify === 'function') {
                    notify(
                        `Trop de ${label} : seuls ${res.documents.length} sur ${res.total} sont chargés.`,
                        'warning'
                    );
                }
            }
        });

        debug('Store loaded from Appwrite:', Store);
    } catch (error) {
        console.error('Error loading Store from Appwrite:', error);
    }
}

// Normalise un document Appwrite (ajoute `id` copié depuis `$id`), comme loadStore().
function mapDoc(d) {
    return { id: d.$id, ...d };
}

// Insère ou remplace un document dans une collection locale du Store,
// sans recharger toute la base. `key` ∈ {'users','projects','versions','tickets'}.
function upsertStoreDoc(key, doc) {
    if (!Store[key]) return;
    const mapped = mapDoc(doc);
    const idx = Store[key].findIndex((item) => item.id === mapped.id);
    if (idx === -1) Store[key].push(mapped);
    else Store[key][idx] = mapped;
    return mapped;
}

// Retire un document d'une collection locale du Store.
function removeStoreDoc(key, id) {
    if (!Store[key]) return;
    Store[key] = Store[key].filter((item) => item.id !== id);
}

// State Management
let currentClientName = '';
let currentProjectId = '';
let currentVersionId = '';
let activeTab = 'details';
let filterUserId = '';
let chartInstances = {};

// Fonctions de calcul (round015Up, round05Up, formatFrenchFloat) migrées vers utils.js
