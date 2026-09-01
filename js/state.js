// state.js — Etat global, Store et chargement Appwrite
// (extrait de l'ancien app.js, chargement en scope global classique)

// Initialize Icons
lucide.createIcons();

// Logs de debug : activer en passant DEBUG à true (ou via ?debug dans l'URL).
const DEBUG = /[?&]debug\b/.test(location.search);
const debug = (...args) => { if (DEBUG) console.log(...args); };

// --- Data Models and Persistence (Appwrite) ---

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
            databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS, [Query.limit(5000)]),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [Query.limit(5000)]),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.VERSIONS, [Query.limit(5000)]),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [Query.limit(5000)])
        ]);

        Store.users = users.documents.map(d => ({ id: d.$id, ...d }));
        Store.projects = projects.documents.map(d => ({ id: d.$id, ...d }));
        Store.versions = versions.documents.map(d => ({ id: d.$id, ...d }));
        Store.tickets = tickets.documents.map(d => ({ id: d.$id, ...d }));

        debug("Store loaded from Appwrite:", Store);
    } catch (error) {
        console.error("Error loading Store from Appwrite:", error);
    }
}

// State Management
let currentClientName = '';
let currentProjectId = '';
let currentVersionId = '';
let activeTab = 'details';
let filterUserId = '';
let chartInstances = {};

// Fonctions de calcul (round015Up, round05Up, formatFrenchFloat) migrées vers utils.js

