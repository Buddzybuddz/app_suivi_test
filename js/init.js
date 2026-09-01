// init.js — Persistance de la selection et sequence d'init
// (extrait de l'ancien app.js, chargement en scope global classique)

// --- Initialization ---
function saveState() {
    localStorage.setItem('TestTracker_Client', currentClientName || '');
    localStorage.setItem('TestTracker_Project', currentProjectId || '');
    localStorage.setItem('TestTracker_Version', currentVersionId || '');
    debug('STATE_SAVE: Selection saved.');
}

function loadState() {
    currentClientName = localStorage.getItem('TestTracker_Client') || '';
    currentProjectId = localStorage.getItem('TestTracker_Project') || '';
    currentVersionId = localStorage.getItem('TestTracker_Version') || '';
    debug('STATE_LOAD: Selection restored from memory.');
}

function validateAndSaveState() {
    // 1. Validation du Client
    const clients = Array.from(new Set(Store.projects.map((p) => (p.client || '').trim())))
        .filter((c) => c !== '')
        .sort();
    if (!currentClientName || !clients.includes(currentClientName)) {
        currentClientName = clients[0] || '';
        currentProjectId = ''; // Invalide le projet enfant
    }

    // 2. Validation du Projet
    const filteredProjects = Store.projects.filter(
        (p) => (p.client || '').trim() === currentClientName
    );
    if (!currentProjectId || !filteredProjects.find((p) => p.id === currentProjectId)) {
        currentProjectId = filteredProjects[0]?.id || '';
        currentVersionId = ''; // Invalide la version enfant
    }

    // 3. Validation de la Version
    const versions = Store.versions.filter((v) => v.projectId === currentProjectId);
    if (!currentVersionId || !versions.find((v) => v.id === currentVersionId)) {
        currentVersionId = versions[0]?.id || '';
    }

    // 4. Mettre à jour les labels
    saveState();
}

async function init() {
    debug('APP_JS: Initiating sequence (v_RELOAD_2k26_05)...');
    refreshDOM();
    setupEventListeners();

    // Par défaut, s'assurer que le tracker est la vue active au démarrage
    switchView('tracker');

    try {
        await loadStore();

        // Charger l'état sauvegardé
        loadState();

        populateHeaderSelects();
        populateFormSelects();
        updateFormUsers();

        // CRITIQUE : Rafraîchir l'interface globale après la restauration de sélection
        updateUI();

        debug('APP_JS: init success (STATE restored and UI updated).');
    } catch (e) {
        console.error('APP_JS: Error during async init:', e);
        updateUI();
    }
}
