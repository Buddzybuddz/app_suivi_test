// Initialize Icons
lucide.createIcons();

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

        console.log("Store loaded from Appwrite:", Store);
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

// --- Logic calculations ---

// Arrondi au multiple de 0.15 supérieur
function round015Up(val) {
    return Math.ceil(val / 0.15) * 0.15;
}

// Arrondi au multiple de 0.5 supérieur
function round05Up(val) {
    return Math.ceil(val / 0.5) * 0.5;
}

function formatFrenchFloat(val) {
    if (val === undefined || val === null || isNaN(val)) return '0,00';
    return parseFloat(val).toFixed(2).replace('.', ',');
}

// Calcule la largeur minimale requise (Version Sécurité Maximale)
function getRequiredWidth(options) {
    if (!options || options.length === 0) return 100;
    const longest = options.reduce((a, b) => (a || "").toString().length > (b || "").toString().length ? a : b, "");
    // Version "Équilibrée" : 10px par caractère + 90px d'offset (Chevron + Marges)
    const w = (longest.toString().length * 9) + 80;
    return Math.ceil(w);
}

window.toggleSort = (table, key) => {
    const opt = Store.sortOptions[table];
    if (opt.key === key) {
        opt.dir = opt.dir === 'asc' ? 'desc' : 'asc';
    } else {
        opt.key = key;
        opt.dir = 'asc';
    }
    updateUI();
};

function updateFilterOptions(tableKey, data) {
    const selects = document.querySelectorAll(`.filter-input[data-filter-table="${tableKey}"]`);
    selects.forEach(select => {
        const col = select.dataset.filterCol;
        if (!col) return;

        const currentVal = Store.filters[tableKey][col] || '';
        const uniqueValues = new Set();

        data.forEach(item => {
            let val = '';
            if (tableKey === 'tickets') {
                if (col === 'assignDesignId' || col === 'assignExecutionId') {
                    val = getUserName(item[col]);
                } else if (col === 'jConception') {
                    val = (item.nbTestCases / (Store.projects.find(p => p.id === currentProjectId)?.designRatio || 1)).toFixed(2);
                } else if (col === 'jExecution') {
                    val = (item.nbTestCases / (Store.projects.find(p => p.id === currentProjectId)?.executionRatio || 1)).toFixed(2);
                } else if (col === 'raf') {
                    const p = Store.projects.find(pr => pr.id === currentProjectId);
                    const c = getCalculations(item, p);
                    val = c.raf;
                } else {
                    val = item[col];
                }
            } else if (tableKey === 'versions' && col === 'project') {
                val = Store.projects.find(p => p.id === item.projectId)?.name || '';
            } else {
                val = item[col];
            }
            if (val !== undefined && val !== null) uniqueValues.add(val.toString());
        });

        const sortedValues = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        // Preserve "Tout" and reconstruction
        select.innerHTML = '<option value="">Tout</option>' +
            sortedValues.map(v => `<option value="${v}" ${v.toLowerCase() === currentVal.toLowerCase() ? 'selected' : ''}>${v}</option>`).join('');
    });
}

function onFilterChange(table, col, val) {
    Store.filters[table][col] = val.toLowerCase();
    if (table === 'projects') {
        renderProjectsTable();
    } else if (table === 'versions') {
        renderVersionsTable();
    } else if (table === 'users') {
        renderUsersTable();
    } else {
        updateUI();
    }
}
window.onFilterChange = onFilterChange;

function filterData(data, tableKey) {
    const filters = Store.filters[tableKey];
    if (!filters || Object.keys(filters).length === 0) return data;

    return data.filter(item => {
        return Object.entries(filters).every(([col, searchVal]) => {
            if (!searchVal) return true;

            let targetVal = '';
            // Handle special mappings or nested data
            if (tableKey === 'tickets') {
                if (col === 'assignDesignId' || col === 'assignExecutionId') {
                    targetVal = getUserName(item[col]);
                } else if (col === 'jConception') {
                    // This is calculated, we might need the project to recalculate or just skip
                    // For now, let's just use string conversion of the item properties
                    targetVal = (item.nbTestCases / (Store.projects.find(p => p.id === currentProjectId)?.designRatio || 1)).toString();
                } else if (col === 'jExecution') {
                    targetVal = (item.nbTestCases / (Store.projects.find(p => p.id === currentProjectId)?.executionRatio || 1)).toString();
                } else if (col === 'raf') {
                    const p = Store.projects.find(pr => pr.id === currentProjectId);
                    const c = getCalculations(item, p);
                    targetVal = c.raf.toString();
                } else {
                    targetVal = (item[col] || '').toString();
                }
            } else if (tableKey === 'versions' && col === 'project') {
                targetVal = Store.projects.find(p => p.id === item.projectId)?.name || '';
            } else {
                targetVal = (item[col] || '').toString();
            }

            return targetVal.toLowerCase() === searchVal.toLowerCase();
        });
    });
}
function getSortIndicator(table, key) {
    const opt = Store.sortOptions[table];
    if (opt.key === key) {
        return opt.dir === 'asc' ? ' ↑' : ' ↓';
    }
    return '';
}

function sortData(data, table) {
    const { key, dir } = Store.sortOptions[table];
    if (!key) return data;

    return [...data].sort((a, b) => {
        let valA = a[key] ?? '';
        let valB = b[key] ?? '';

        // Handle nested or special fields
        if (key === 'project') { // For versions table
            valA = Store.projects.find(p => p.id === a.projectId)?.name || '';
            valB = Store.projects.find(p => p.id === b.projectId)?.name || '';
        }

        if (typeof valA === 'string') {
            const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
            return dir === 'asc' ? cmp : -cmp;
        }
        return dir === 'asc' ? (valA - valB) : (valB - valA);
    });
}

function updateSortIndicators(table) {
    const opt = Store.sortOptions[table];
    // Clear all indicators for this table
    document.querySelectorAll(`[id^="sort-${table}-"]`).forEach(s => s.textContent = '');
    // Set active one
    const active = document.getElementById(`sort-${table}-${opt.key}`);
    if (active) {
        active.textContent = opt.dir === 'asc' ? ' ↑' : ' ↓';
        active.style.marginLeft = '5px';
        active.style.opacity = '0.7';
    }
}

function enableColumnResizing(tableElement, tableKey) {
    if (!tableElement) return;
    const allHeaders = tableElement.querySelectorAll('thead th');
    const firstRowHeaders = Array.from(tableElement.querySelectorAll('thead tr:first-child th'));

    allHeaders.forEach((th) => {
        const colId = th.dataset.col;
        if (!colId || colId === 'actions') return;

        const masterTh = firstRowHeaders.find(m => m.dataset.col === colId) || th;

        if (Store.columnWidths[tableKey][colId]) {
            masterTh.style.width = Store.columnWidths[tableKey][colId] + 'px';
            masterTh.style.minWidth = Store.columnWidths[tableKey][colId] + 'px';
        }

        // Add resizer if missing
        if (!th.querySelector('.resizer')) {
            const resizer = document.createElement('div');
            resizer.className = 'resizer';
            th.appendChild(resizer);

            // Initial total width sync
            let initialTotal = 0;
            firstRowHeaders.forEach(h => {
                initialTotal += (parseInt(h.style.width) || h.offsetWidth || 100);
            });
            tableElement.style.width = initialTotal + 'px';

            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.body.classList.add('resizing');

                const startX = e.pageX;
                const startWidth = masterTh.offsetWidth;

                const onMouseMove = (moveEvent) => {
                    const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX));
                    masterTh.style.width = newWidth + 'px';
                    masterTh.style.minWidth = newWidth + 'px'; // CRITICAL: Force min-width
                    Store.columnWidths[tableKey][colId] = newWidth;

                    // Force table to be wide enough to contain all fixed columns
                    let totalWidth = 0;
                    firstRowHeaders.forEach(h => {
                        totalWidth += (parseInt(h.style.width) || h.offsetWidth || 100);
                    });
                    tableElement.style.width = totalWidth + 'px';
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.classList.remove('resizing');
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            resizer.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const oldLayout = tableElement.style.tableLayout;
                tableElement.style.tableLayout = 'auto';
                masterTh.style.width = 'auto';

                requestAnimationFrame(() => {
                    const autoWidth = masterTh.offsetWidth;
                    masterTh.style.width = autoWidth + 'px';
                    tableElement.style.tableLayout = 'fixed';
                    Store.columnWidths[tableKey][colId] = autoWidth;
                });
            });
        }
    });
}

function getCalculations(ticket, project) {
    if (!project) return { jConception: '0.00', jExecution: '0.00', raf: '0.00' };
    const jConception = round015Up(ticket.nbTestCases / project.designRatio);
    const jExecution = round015Up(ticket.nbTestCases / project.executionRatio);
    
    // Nouvelle règle : Charge entière si pas terminé, 0 sinon
    const rafC = ticket.statusDesign !== 'Terminée' ? jConception : 0;
    const rafE = (ticket.statusExecution !== 'Terminée OK' && ticket.statusExecution !== 'Terminée KO') ? jExecution : 0;
    
    const raf = round015Up(rafC + rafE);
    return {
        jConception: formatFrenchFloat(jConception),
        jExecution: formatFrenchFloat(jExecution),
        raf: formatFrenchFloat(raf),
        rafC: rafC,
        rafE: rafE,
        rawJConception: jConception,
        rawJExecution: jExecution,
        rawRaf: raf
    };
}

let DOM = {};

function refreshDOM() {
    DOM = {
        // Nav & Views
        navItems: document.querySelectorAll('.nav-item'),
        viewSections: document.querySelectorAll('.view-section'),

        // Project View
        projectsTbody: document.getElementById('projectsTbody'),
        btnNewProject: document.getElementById('btnNewProject'),
        projectModal: document.getElementById('projectModal'),
        projectModalTitle: document.getElementById('projectModalTitle'),
        btnCloseProjectModal: document.getElementById('btnCloseProjectModal'),
        projectForm: document.getElementById('projectForm'),
        pId: document.getElementById('pId'),
        pClient: document.getElementById('pClient'),
        pName: document.getElementById('pName'),
        pStateInput: document.getElementById('pStateInput'),
        btnAddState: document.getElementById('btnAddState'),
        projectStatesContainer: document.getElementById('projectStatesContainer'),
        pUserSelectToAdd: document.getElementById('pUserSelectToAdd'),
        btnAddExistingUser: document.getElementById('btnAddExistingUser'),
        pNewUserName: document.getElementById('pNewUserName'),
        btnCreateAndAddUser: document.getElementById('btnCreateAndAddUser'),
        projectMembersContainer: document.getElementById('projectMembersContainer'),
        pRatioC: document.getElementById('pRatioC'),
        pRatioE: document.getElementById('pRatioE'),

        // User UI
        usersTbody: document.getElementById('usersTbody'),
        btnNewUser: document.getElementById('btnNewUser'),
        userModal: document.getElementById('userModal'),
        userModalTitle: document.getElementById('userModalTitle'),
        btnCloseUserModal: document.getElementById('btnCloseUserModal'),
        userForm: document.getElementById('userForm'),
        uId: document.getElementById('uId'),
        uiName: document.getElementById('uiName'),
        uRole: document.getElementById('uRole'),

        // Version UI
        btnNewVersion: document.getElementById('btnNewVersion'),
        btnNewVersionPage: document.getElementById('btnNewVersionPage'),
        versionsTbody: document.getElementById('versionsTbody'),
        versionModal: document.getElementById('versionModal'),
        versionModalTitle: document.getElementById('versionModalTitle'),
        btnCloseVersionModal: document.getElementById('btnCloseVersionModal'),
        versionForm: document.getElementById('versionForm'),
        vId: document.getElementById('vId'),
        vClient: document.getElementById('vClient'),
        vProject: document.getElementById('vProject'),
        vName: document.getElementById('vName'),
        vDateRecette_D: document.getElementById('vDateRecette_D'),
        vDateRecette_M: document.getElementById('vDateRecette_M'),
        vDateRecette_Y: document.getElementById('vDateRecette_Y'),
        vDate_D: document.getElementById('vDate_D'),
        vDate_M: document.getElementById('vDate_M'),
        vDate_Y: document.getElementById('vDate_Y'),

        clientSelect: document.getElementById('clientSelect'),
        projectSelect: document.getElementById('projectSelect'),
        versionSelect: document.getElementById('versionSelect'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        ticketsTbody: document.getElementById('ticketsTbody'),
        filterUser: document.getElementById('filterUser'),
        btnNewTicket: document.getElementById('btnNewTicket'),
        btnCopyDashboard: document.getElementById('btnCopyDashboard'),
        btnCopyCharts: document.getElementById('btnCopyCharts'),
        modal: document.getElementById('ticketModal'),
        btnCloseModal: document.getElementById('btnCloseModal'),
        ticketForm: document.getElementById('ticketForm'),

        // KPI
        kpiTotalRaf: document.getElementById('kpiTotalRaf'),
        kpiTotalTickets: document.getElementById('kpiTotalTickets'),
        kpiAdvC: document.getElementById('kpiAdvC'),
        kpiAdvE: document.getElementById('kpiAdvE'),
        kpiAdvTotal: document.getElementById('kpiAdvTotal'),
        dashProjectName: document.getElementById('dashProjectName'),
        dashVersionName: document.getElementById('dashVersionName'),

        // Form Inputs
        fFeat: document.getElementById('fFeat'), fFeatList: document.getElementById('feature-list'),
        fType: document.getElementById('fType'),
        fNum: document.getElementById('fNum'), fPrio: document.getElementById('fPrio'),
        fAssC: document.getElementById('fAssC'), fAssE: document.getElementById('fAssE'),
        fTests: document.getElementById('fTests'), fState: document.getElementById('fState'),
        fVersion: document.getElementById('fVersion'),
        tId: document.getElementById('tId'),
        mainContent: document.querySelector('.main-content')
    };

    console.log("DOM elements refreshed. projectsTbody exists:", !!DOM.projectsTbody);
}

// --- Initialization ---
function saveState() {
    localStorage.setItem('TestTracker_Client', currentClientName || '');
    localStorage.setItem('TestTracker_Project', currentProjectId || '');
    localStorage.setItem('TestTracker_Version', currentVersionId || '');
    console.log("STATE_SAVE: Selection saved.");
}

function loadState() {
    currentClientName = localStorage.getItem('TestTracker_Client') || '';
    currentProjectId = localStorage.getItem('TestTracker_Project') || '';
    currentVersionId = localStorage.getItem('TestTracker_Version') || '';
    console.log("STATE_LOAD: Selection restored from memory.");
}

function validateAndSaveState() {
    // 1. Validation du Client
    const clients = Array.from(new Set(Store.projects.map(p => (p.client || '').trim()))).filter(c => c !== '').sort();
    if (!currentClientName || !clients.includes(currentClientName)) {
        currentClientName = clients[0] || '';
        currentProjectId = ''; // Invalide le projet enfant
    }

    // 2. Validation du Projet
    const filteredProjects = Store.projects.filter(p => (p.client || '').trim() === currentClientName);
    if (!currentProjectId || !filteredProjects.find(p => p.id === currentProjectId)) {
        currentProjectId = filteredProjects[0]?.id || '';
        currentVersionId = ''; // Invalide la version enfant
    }

    // 3. Validation de la Version
    const versions = Store.versions.filter(v => v.projectId === currentProjectId);
    if (!currentVersionId || !versions.find(v => v.id === currentVersionId)) {
        currentVersionId = versions[0]?.id || '';
    }

    // 4. Mettre à jour les labels
    saveState();
}

async function init() {
    console.log("APP_JS: Initiating sequence (v_RELOAD_2k26_05)...");
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
        
        console.log("APP_JS: init success (STATE restored and UI updated).");
    } catch (e) {
        console.error("APP_JS: Error during async init:", e);
        updateUI();
    }
}

/**
 * Fonction centrale de basculement de vue
 */
function switchView(viewName) {
    if (!viewName) return;
    console.log("SWITCH_VIEW: target =", viewName);

    // Refresh DOM pour être sûr d'avoir les éléments à jour
    refreshDOM();

    // 1. Sidebar highlight
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(n => {
        if (n.getAttribute('data-view') === viewName) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
    });

    // 2. Sections display
    const sections = document.querySelectorAll('.view-section');
    sections.forEach(s => {
        const idSuffix = s.id.replace('view-', '');
        if (idSuffix === viewName) {
            s.classList.add('active');
            s.style.setProperty('display', 'flex', 'important');
            s.style.setProperty('visibility', 'visible', 'important');
            s.style.setProperty('opacity', '1', 'important');
            
            // Log de diagnostic pour confirmer la présence à l'écran
            const rect = s.getBoundingClientRect();
            console.log(`SECTION_STATS [${s.id}]: Visible: true, Rect: w=${rect.width}, h=${rect.height}, top=${rect.top}`);
        } else {
            s.classList.remove('active');
            s.style.setProperty('display', 'none', 'important');
        }
    });

    // 3. Render specific data
    if (viewName === 'projects') renderProjectsTable();
    else if (viewName === 'versions') renderVersionsTable();
    else if (viewName === 'users') renderUsersTable();
    else if (viewName === 'tracker') {
        activeTab = 'details';
        updateUI();
    }
}

function populateHeaderSelects() {
    if (!DOM.clientSelect || !DOM.projectSelect) return;

    validateAndSaveState();

    const clients = Array.from(new Set(Store.projects.map(p => (p.client || '').trim()))).filter(c => c !== '').sort();
    
    console.log("POPULATE_HEADER: Available clients:", clients);
    
    DOM.clientSelect.innerHTML = (clients.length > 0) 
        ? clients.map(c => `<option value="${c}">${c}</option>`).join('')
        : '<option value="">Sans Client</option>';
    DOM.clientSelect.value = currentClientName;

    const filteredProjects = Store.projects.filter(p => (p.client || '').trim() === currentClientName);
    console.log(`POPULATE_HEADER: Projects for [${currentClientName}]:`, filteredProjects.length);
    
    DOM.projectSelect.innerHTML = filteredProjects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    DOM.projectSelect.value = currentProjectId;

    // Mise à jour de la liste dans le modal version
    if (DOM.vProject) {
        DOM.vProject.innerHTML = Store.projects.map(p => {
            const displayName = p.client ? `${p.client} - ${p.name}` : p.name;
            return `<option value="${p.id}">${displayName}</option>`;
        }).join('');
    }

    updateVersionSelect();
    
    // Déclenchement automatique de la mise à jour UI pour peupler le tracker avec le premier projet s'il y en a un
    updateUI();
}

function updateVersionSelect() {
    if (!DOM.versionSelect) return;
    
    validateAndSaveState(); // Au cas où
    
    const versions = Store.versions.filter(v => v.projectId === currentProjectId);
    console.log(`UPDATE_VERSION: Versions for project [${currentProjectId}]:`, versions.length);
    
    DOM.versionSelect.innerHTML = versions.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    DOM.versionSelect.value = currentVersionId;
}

function populateFormSelects() {
    // Only keeping for retro-compatibility if needed
}

let currentProjectUsers = [];
let currentProjectStates = [];

function populatePUserSelectToAdd() {
    if (!DOM.pUserSelectToAdd) return;
    const available = Store.users.filter(u => !currentProjectUsers.includes(u.id));
    DOM.pUserSelectToAdd.innerHTML = `<option value="">-- Sélectionner un utilisateur --</option>` +
        available.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
}

function renderProjectMembersBadge() {
    if (!DOM.projectMembersContainer) return;
    if (currentProjectUsers.length === 0) {
        DOM.projectMembersContainer.innerHTML = `<span class="members-placeholder">Aucun membre sélectionné.</span>`;
        return;
    }
    DOM.projectMembersContainer.innerHTML = currentProjectUsers.map(uid => {
        const u = Store.users.find(usr => usr.id === uid);
        const name = u ? u.name : 'Inconnu';
        return `
            <div class="member-badge">
                ${name}
                <i data-lucide="x" class="member-badge-remove" onclick="removeUserFromProjectUI('${uid}')"></i>
            </div>
        `;
    }).join('');
    lucide.createIcons();
    populatePUserSelectToAdd();
}

function renderProjectStatesBadge() {
    if (!DOM.projectStatesContainer) return;
    if (currentProjectStates.length === 0) {
        DOM.projectStatesContainer.innerHTML = `<span class="members-placeholder">Aucun état défini.</span>`;
        return;
    }
    DOM.projectStatesContainer.innerHTML = currentProjectStates.map(state => `
        <div class="member-badge">
            ${state}
            <i data-lucide="x" class="member-badge-remove" onclick="removeProjectStateUI('${state}')"></i>
        </div>
    `).join('');
    lucide.createIcons();
}

window.removeUserFromProjectUI = (uid) => {
    currentProjectUsers = currentProjectUsers.filter(id => id !== uid);
    renderProjectMembersBadge();
};

window.removeProjectStateUI = (state) => {
    currentProjectStates = currentProjectStates.filter(s => s !== state);
    renderProjectStatesBadge();
};

function updateFormUsers() {
    const project = Store.projects.find(p => p.id === currentProjectId);
    let allowedUsers = Store.users;
    if (project && project.userIds && project.userIds.length > 0) {
        allowedUsers = Store.users.filter(u => project.userIds.includes(u.id));
    }

    const usersOptions = `<option value="">-- Aucun --</option>` + allowedUsers.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
    DOM.fAssC.innerHTML = usersOptions;
    DOM.fAssE.innerHTML = usersOptions;

    DOM.filterUser.innerHTML = `<option value="">Tous les utilisateurs</option>` + allowedUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
}

// Project Modal Logic
const openProjectModal = (p = null) => {
    DOM.projectForm.reset();
    if (p) {
        DOM.projectModalTitle.textContent = "Modifier le Projet";
        DOM.pId.value = p.id;
        DOM.pClient.value = p.client || '';
        DOM.pName.value = p.name;
        currentProjectStates = p.ticketStates ? [...p.ticketStates] : ['Nouveau'];
        DOM.pRatioC.value = p.designRatio;
        DOM.pRatioE.value = p.executionRatio;
        currentProjectUsers = p.userIds ? [...p.userIds] : [];
    } else {
        DOM.projectModalTitle.textContent = "Nouveau Projet";
        DOM.pId.value = '';
        DOM.pClient.value = '';
        currentProjectStates = ['Nouveau', 'Validé', 'Rejeté', 'Fermé'];
        currentProjectUsers = [];
    }
    renderProjectMembersBadge();
    renderProjectStatesBadge();
    DOM.projectModal.classList.add('show');
};

const MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

function getDaysInMonth(month, year) {
    return new Date(year, month, 0).getDate();
}

function populate31Days(dEl) {
    let daysHtml = '<option value="">Jour</option>';
    for (let d = 1; d <= 31; d++) {
        daysHtml += `<option value="${d}">${d < 10 ? '0' + d : d}</option>`;
    }
    dEl.innerHTML = daysHtml;
}

function updateDaysList(dEl, mEl, yEl) {
    const year = parseInt(yEl.value) || new Date().getFullYear();
    const month = parseInt(mEl.value) || 1;
    const currentDay = dEl.value;
    const daysCount = getDaysInMonth(month, year);
    
    let daysHtml = '<option value="">Jour</option>';
    for (let d = 1; d <= daysCount; d++) {
        daysHtml += `<option value="${d}">${d < 10 ? '0' + d : d}</option>`;
    }
    dEl.innerHTML = daysHtml;
    if (currentDay && parseInt(currentDay) <= daysCount) {
        dEl.value = currentDay;
    }
}

function setupDateSelectorGroup(dEl, mEl, yEl) {
    // Populate Years
    const currentYear = new Date().getFullYear();
    let yearsHtml = '<option value="">Année</option>';
    for (let y = currentYear - 1; y <= currentYear + 10; y++) {
        yearsHtml += `<option value="${y}">${y}</option>`;
    }
    yEl.innerHTML = yearsHtml;

    // Populate Months
    let monthsHtml = '<option value="">Mois</option>';
    MONTH_NAMES.forEach((m, i) => {
        monthsHtml += `<option value="${i + 1}">${m}</option>`;
    });
    mEl.innerHTML = monthsHtml;

    // Populate Days
    populate31Days(dEl);

    // Listeners
    mEl.addEventListener('change', () => updateDaysList(dEl, mEl, yEl));
    yEl.addEventListener('change', () => updateDaysList(dEl, mEl, yEl));
}

function setDateValues(dEl, mEl, yEl, dateStr) {
    if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            yEl.value = d.getFullYear();
            mEl.value = d.getMonth() + 1;
            updateDaysList(dEl, mEl, yEl);
            dEl.value = d.getDate();
            return;
        }
    }
    yEl.value = "";
    mEl.value = "";
    populate31Days(dEl);
}

function getDateStringFromSelectors(dEl, mEl, yEl) {
    const y = yEl.value;
    const m = mEl.value;
    const d = dEl.value;
    if (!y || !m || !d) return null;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Version Modal Logic
const openVersionModal = (v = null, fromHeader = false) => {
    DOM.versionForm.reset();
    
    // 1. Peupler les clients dans la modale
    const clients = Array.from(new Set(Store.projects.map(p => p.client || ''))).sort();
    DOM.vClient.innerHTML = clients.map(c => `<option value="${c}">${c || 'Sans Client'}</option>`).join('');
    
    const updateVProjectList = (clientName) => {
        const filtered = Store.projects.filter(p => (p.client || '') === clientName);
        DOM.vProject.innerHTML = filtered.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    };

    if (v) {
        const p = Store.projects.find(proj => proj.id === v.projectId);
        const cName = p ? (p.client || '') : '';
        
        DOM.versionModalTitle.textContent = "Modifier la Version";
        DOM.vId.value = v.id;
        DOM.vClient.value = cName;
        updateVProjectList(cName);
        DOM.vProject.value = v.projectId;
        DOM.vClient.disabled = true;
        DOM.vProject.disabled = true;
        DOM.vName.value = v.name;
        setDateValues(DOM.vDateRecette_D, DOM.vDateRecette_M, DOM.vDateRecette_Y, v.deliveryDateRecette);
        setDateValues(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y, v.deliveryDateClient);
    } else {
        DOM.versionModalTitle.textContent = "Nouvelle Version";
        DOM.vId.value = '';
        setDateValues(DOM.vDateRecette_D, DOM.vDateRecette_M, DOM.vDateRecette_Y, null);
        setDateValues(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y, null);
        DOM.vClient.disabled = false;
        DOM.vProject.disabled = false;
        
        // Initialisation basée sur la sélection actuelle du header si possible
        const initClient = fromHeader ? currentClientName : (clients[0] || '');
        DOM.vClient.value = initClient;
        updateVProjectList(initClient);
        
        if (fromHeader && currentProjectId) {
            DOM.vProject.value = currentProjectId;
        }
    }
    DOM.versionModal.classList.add('show');
};

// User Modal Logic
const openUserModal = (u = null) => {
    DOM.userForm.reset();
    if (u) {
        DOM.userModalTitle.textContent = "Modifier l'Utilisateur";
        DOM.uId.value = u.id;
        DOM.uiName.value = u.name;
        DOM.uiEmail.value = u.email;
        DOM.uRole.value = u.role;
    } else {
        DOM.userModalTitle.textContent = "Nouvel Utilisateur";
        DOM.uId.value = '';
        DOM.uRole.value = 'Testeur';
    }
    DOM.userModal.classList.add('show');
};

function updateFormStates() {
    const project = Store.projects.find(p => p.id === currentProjectId);
    if (project) {
        DOM.fState.innerHTML = project.ticketStates.map(s => `<option value="${s}">${s}</option>`).join('');
    }
}

function updateFormVersions() {
    const versions = Store.versions.filter(v => v.projectId === currentProjectId);
    DOM.fVersion.innerHTML = versions.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    DOM.fVersion.value = currentVersionId;
}

function updateFeatureDatalist() {
    if (!DOM.fFeatList) return;
    const features = new Set();
    Store.tickets.forEach(t => {
        const v = Store.versions.find(ver => ver.id === t.versionId);
        if (v && v.projectId === currentProjectId && t.feature) {
            features.add(t.feature);
        }
    });
    DOM.fFeatList.innerHTML = Array.from(features).sort().map(f => `<option value="${f}">`).join('');
}

// --- Event Listeners ---
function setupEventListeners() {
    // Sidebar Navigation
    const navElements = document.querySelectorAll('.nav-item');
    navElements.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetEl = e.currentTarget;
            const targetView = targetEl.getAttribute('data-view') || targetEl.dataset.view;
            switchView(targetView);
        });
    });





    if (DOM.btnAddState) {
        DOM.btnAddState.addEventListener('click', () => {
            const val = DOM.pStateInput.value.trim();
            if (val && !currentProjectStates.includes(val)) {
                currentProjectStates.push(val);
                DOM.pStateInput.value = '';
                renderProjectStatesBadge();
            }
        });
    }

    if (DOM.btnAddExistingUser) {
        DOM.btnAddExistingUser.addEventListener('click', () => {
            const uid = DOM.pUserSelectToAdd.value;
            if (!uid) return;
            if (currentProjectUsers.includes(uid)) {
                alert("Erreur : Cet utilisateur est déjà attribué à ce projet.");
                return;
            }
            currentProjectUsers.push(uid);
            renderProjectMembersBadge();
        });
    }

    if (DOM.btnNewProject) {
        DOM.btnNewProject.addEventListener('click', () => {
            openProjectModal(null);
        });

        DOM.btnCloseProjectModal.addEventListener('click', () => {
            DOM.projectModal.classList.remove('show');
        });

        DOM.projectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pId = DOM.pId.value;
            const selectedUsers = [...currentProjectUsers];
            const selectedStates = [...currentProjectStates];

            const data = {
                client: DOM.pClient.value,
                name: DOM.pName.value,
                ticketStates: selectedStates.length > 0 ? selectedStates : ['Nouveau'],
                userIds: selectedUsers,
                designRatio: parseFloat(DOM.pRatioC.value) || 1,
                executionRatio: parseFloat(DOM.pRatioE.value) || 1
            };

            try {
                if (pId) {
                    await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, pId, data);
                } else {
                    const res = await databases.createDocument(DATABASE_ID, COLLECTIONS.PROJECTS, ID.unique(), data);
                    currentProjectId = res.$id;
                }

                await loadStore(); // Refresh local store
                DOM.projectModal.classList.remove('show');
                renderProjectsTable();
                populateHeaderSelects();
                updateFormUsers();
                if (typeof renderVersionsTable === 'function') renderVersionsTable();
                updateUI();
            } catch (error) {
                console.error("Error saving project:", error);
                alert("Erreur lors de l'enregistrement du projet.");
            }
        });
    }



    // Listener pour le changement de client dans la modale version
    if (DOM.vClient) {
        DOM.vClient.addEventListener('change', (e) => {
            const clientName = e.target.value;
            const filtered = Store.projects.filter(p => (p.client || '') === clientName);
            DOM.vProject.innerHTML = filtered.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        });
    }

    if (DOM.btnNewVersion) {
        DOM.btnNewVersion.addEventListener('click', () => {
            if (!currentProjectId) return alert("Veuillez d'abord sélectionner un projet.");
            openVersionModal(null, true);
        });
    }

    if (DOM.btnNewVersionPage) {
        DOM.btnNewVersionPage.addEventListener('click', () => {
            if (Store.projects.length === 0) return alert("Veuillez d'abord créer un projet.");
            openVersionModal(null, false);
        });
    }

    if (DOM.versionModal) {
        DOM.btnCloseVersionModal.addEventListener('click', () => {
            DOM.versionModal.classList.remove('show');
        });

        DOM.versionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const vId = DOM.vId.value;
            const data = {
                projectId: DOM.vProject.value,
                name: DOM.vName.value,
                deliveryDateRecette: getDateStringFromSelectors(DOM.vDateRecette_D, DOM.vDateRecette_M, DOM.vDateRecette_Y),
                deliveryDateClient: getDateStringFromSelectors(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y)
            };

            try {
                if (vId) {
                    await databases.updateDocument(DATABASE_ID, COLLECTIONS.VERSIONS, vId, data);
                } else {
                    const res = await databases.createDocument(DATABASE_ID, COLLECTIONS.VERSIONS, ID.unique(), data);
                    currentVersionId = res.$id;
                }

                await loadStore();
                DOM.versionModal.classList.remove('show');
                updateVersionSelect();
                if (DOM.versionSelect.querySelector(`option[value="${currentVersionId}"]`)) {
                    DOM.versionSelect.value = currentVersionId;
                }
                updateUI();
                if (activeTab === 'versions') renderVersionsTable();
                renderVersionsTable();
            } catch (error) {
                console.error("Error saving version:", error);
                alert("Erreur lors de l'enregistrement de la version.");
            }
        });
    }


    if (DOM.btnNewUser) {
        DOM.btnNewUser.addEventListener('click', () => {
            openUserModal(null);
        });

        DOM.btnCloseUserModal.addEventListener('click', () => {
            DOM.userModal.classList.remove('show');
        });

        DOM.userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uid = DOM.uId.value;
            const newName = DOM.uiName.value.trim();
            
            // Vérification de l'unicité globale
            const isDuplicate = Store.users.some(u => 
                u.name.toLowerCase() === newName.toLowerCase() && u.id !== uid
            );
            
            if (isDuplicate) {
                alert("Action impossible : Cet utilisateur existe déjà dans l'Annuaire.");
                return;
            }

            const data = {
                name: newName,
                role: DOM.uRole.value
            };

            try {
                if (uid) {
                    await databases.updateDocument(DATABASE_ID, COLLECTIONS.USERS, uid, data);
                } else {
                    await databases.createDocument(DATABASE_ID, COLLECTIONS.USERS, ID.unique(), data);
                }

                await loadStore();
                DOM.userModal.classList.remove('show');
                renderUsersTable();
                populateFormSelects();
                updateFormUsers();
                renderTicketsTable();
                updateUI();
            } catch (error) {
                console.error("Error saving user:", error);
                alert("Erreur lors de l'enregistrement de l'utilisateur.");
            }
        });
    }

    if (DOM.btnCopyDashboard) {
        DOM.btnCopyDashboard.addEventListener('click', async () => {
            const originalText = DOM.btnCopyDashboard.innerHTML;
            DOM.btnCopyDashboard.innerHTML = '<i data-lucide="loader"></i> ...';
            if (typeof lucide !== 'undefined') lucide.createIcons();

            try {
                const viewTracker = document.getElementById('view-tracker');
                
                // 1. CLONE - Deep clone to avoid messing with live DOM
                const clone = viewTracker.cloneNode(true);
                
                // 2. PREPARE THE CLONE STYLE - Off-screen and absolute height
                const originalWidth = viewTracker.offsetWidth;
                clone.style.position = 'absolute';
                clone.style.left = '-9999px';
                clone.style.top = '0';
                clone.style.width = originalWidth + 'px';
                clone.style.height = 'auto'; // CRITICAL: Force auto height
                clone.style.overflow = 'visible'; // CRITICAL: Show everything
                clone.style.backgroundColor = '#f1f5f9';
                
                document.body.appendChild(clone);
                
                // 3. CLEANUP THE CLONE (Remove charts, tabs, ignored elements)
                const chartsClone = clone.querySelector('#chartsRegion');
                if (chartsClone) chartsClone.remove();
                
                const tabsClone = clone.querySelector('.tabs-container');
                if (tabsClone) tabsClone.remove();
                
                // Remove elements marked with data-html2canvas-ignore
                clone.querySelectorAll('[data-html2canvas-ignore]').forEach(el => el.remove());
                
                // 4. REPLACE SELECTS WITH STATIC TEXT IN CLONE
                clone.querySelectorAll('select').forEach(sel => {
                    const originalSel = document.getElementById(sel.id);
                    const val = originalSel ? originalSel.options[originalSel.selectedIndex]?.text : '-';
                    
                    const span = document.createElement('span');
                    span.textContent = val;
                    span.style.cssText = 'font-weight: 700; font-size: 1.1rem; color: var(--text-main); margin-top: 0.2rem; display: block;';
                    
                    sel.replaceWith(span);
                });

                // 5. CAPTURE THE CLONE
                const canvas = await html2canvas(clone, {
                    backgroundColor: '#f1f5f9',
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    scrollX: 0,
                    scrollY: 0,
                    width: originalWidth,
                    windowWidth: originalWidth,
                    windowHeight: clone.scrollHeight
                });

                // 6. REMOVE CLONE
                document.body.removeChild(clone);

                canvas.toBlob(async (blob) => {
                    if (!blob) throw new Error("Erreur lors de la création de l'image.");
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);

                    DOM.btnCopyDashboard.innerHTML = '<i data-lucide="check"></i> Copié !';
                    DOM.btnCopyDashboard.style.background = 'var(--success)';
                    if (typeof lucide !== 'undefined') lucide.createIcons();

                    setTimeout(() => {
                        DOM.btnCopyDashboard.innerHTML = originalText;
                        DOM.btnCopyDashboard.style.background = 'var(--accent-secondary)';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }, 2000);
                });
            } catch (err) {
                console.error(err);
                alert("Erreur de capture du rapport.");
                DOM.btnCopyDashboard.innerHTML = originalText;
            }
        });
    }

    if (DOM.btnCopyCharts) {
        DOM.btnCopyCharts.addEventListener('click', async () => {
            const originalText = DOM.btnCopyCharts.innerHTML;
            DOM.btnCopyCharts.innerHTML = '<i data-lucide="loader"></i> ...';
            if (typeof lucide !== 'undefined') lucide.createIcons();

            try {
                const chartsRegion = document.getElementById('chartsRegion');
                if (!chartsRegion) return;

                const clone = chartsRegion.cloneNode(true);
                const originalWidth = chartsRegion.offsetWidth;
                
                clone.style.position = 'absolute';
                clone.style.left = '-9999px';
                clone.style.top = '0';
                clone.style.width = originalWidth + 'px';
                clone.style.height = 'auto';
                clone.style.overflow = 'visible';
                clone.style.backgroundColor = '#f1f5f9';
                
                document.body.appendChild(clone);

                const canvas = await html2canvas(clone, {
                    backgroundColor: '#f1f5f9',
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    windowHeight: clone.scrollHeight
                });

                document.body.removeChild(clone);

                canvas.toBlob(async (blob) => {
                    if (!blob) throw new Error("Erreur lors de la création de l'image.");
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);

                    DOM.btnCopyCharts.innerHTML = '<i data-lucide="check"></i> Copié !';
                    DOM.btnCopyCharts.style.background = 'var(--success)';
                    if (typeof lucide !== 'undefined') lucide.createIcons();

                    setTimeout(() => {
                        DOM.btnCopyCharts.innerHTML = originalText;
                        DOM.btnCopyCharts.style.background = '#8b5cf6';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }, 2000);
                });
            } catch (err) {
                console.error(err);
                alert("Erreur de capture des graphiques.");
                DOM.btnCopyCharts.innerHTML = originalText;
            }
        });
    }

    // Initialize custom date selectors once
    setupDateSelectorGroup(DOM.vDateRecette_D, DOM.vDateRecette_M, DOM.vDateRecette_Y);
    setupDateSelectorGroup(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y);

    if (DOM.clientSelect) {
        DOM.clientSelect.addEventListener('change', (e) => {
            currentClientName = e.target.value;
            currentProjectId = ''; // Invalider le projet courant pour forcer le 1er du client
            validateAndSaveState();
            populateHeaderSelects();
            updateFormUsers();
            updateUI();
        });
    }

    DOM.projectSelect.addEventListener('change', (e) => {
        currentProjectId = e.target.value;
        const p = Store.projects.find(proj => proj.id === currentProjectId);
        if (p) currentClientName = p.client || '';
        
        currentVersionId = ''; // Invalider la version courante
        validateAndSaveState();
        populateHeaderSelects();
        updateFormUsers();
        updateUI();
    });

    DOM.versionSelect.addEventListener('change', (e) => {
        currentVersionId = e.target.value;
        validateAndSaveState();
        updateUI();
    });

    DOM.filterUser.addEventListener('change', (e) => {
        filterUserId = e.target.value;
        renderTicketsTable();
    });

    DOM.tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            DOM.tabs.forEach(t => t.classList.remove('active'));
            DOM.tabContents.forEach(c => c.classList.remove('active'));

            e.target.classList.add('active');
            activeTab = e.target.dataset.tab;
            document.getElementById(`tab-${activeTab}`).classList.add('active');

            if (activeTab === 'dashboard') {
                renderDashboard();
            }
        });
    });

    // Modal
    DOM.btnNewTicket.addEventListener('click', () => {
        if (!currentVersionId) return alert("Veuillez sélectionner une version d'abord.");
        updateFormStates();
        updateFormVersions();
        updateFeatureDatalist();
        DOM.ticketForm.reset();
        if (DOM.tId) DOM.tId.value = '';
        DOM.fVersion.value = currentVersionId;
        const mTitle = document.getElementById('modalTitle');
        if (mTitle) mTitle.textContent = "Nouveau Ticket";
        DOM.modal.classList.add('show');
    });

    DOM.btnCloseModal.addEventListener('click', () => {
        DOM.modal.classList.remove('show');
    });

    DOM.ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tIdValue = DOM.tId ? DOM.tId.value : null;
        const nbTests = parseFloat(DOM.fTests.value) || 0;

        const targetVersionId = DOM.fVersion.value || currentVersionId;
        const targetVersion = Store.versions.find(v => v.id === targetVersionId);
        const targetProjectId = targetVersion ? targetVersion.projectId : null;
        const newNumber = parseInt(DOM.fNum.value) || 0;

        // Validation d'unicité par projet
        if (targetProjectId && newNumber > 0) {
            const isDuplicate = Store.tickets.some(t => {
                if (tIdValue && t.id === tIdValue) return false; // Ignorer le ticket web en cours d'édition
                const v = Store.versions.find(ver => ver.id === t.versionId);
                return v && v.projectId === targetProjectId && t.number === newNumber;
            });

            if (isDuplicate) {
                alert(`Le numéro de ticket #${newNumber} est déjà utilisé dans ce projet. Veuillez en choisir un autre.`);
                return;
            }
        }

        const data = {
            versionId: targetVersionId,
            feature: DOM.fFeat.value,
            type: DOM.fType.value,
            number: newNumber,
            priority: DOM.fPrio.value,
            assignDesignId: DOM.fAssC.value || null,
            assignExecutionId: DOM.fAssE.value || null,
            nbTestCases: nbTests,
            ticketState: DOM.fState.value,
            consumed: tIdValue ? (Store.tickets.find(t => t.id === tIdValue)?.consumed || 0) : 0,
            statusDesign: tIdValue ? (Store.tickets.find(t => t.id === tIdValue)?.statusDesign || 'À faire') : 'À faire',
            statusExecution: tIdValue ? (Store.tickets.find(t => t.id === tIdValue)?.statusExecution || 'En attente livraison') : 'En attente livraison',
            comment: tIdValue ? (Store.tickets.find(t => t.id === tIdValue)?.comment || '') : ''
        };

        try {
            if (tIdValue) {
                await databases.updateDocument(DATABASE_ID, COLLECTIONS.TICKETS, tIdValue, data);
            } else {
                await databases.createDocument(DATABASE_ID, COLLECTIONS.TICKETS, ID.unique(), data);
            }

            await loadStore();
            DOM.modal.classList.remove('show');
            updateUI();
        } catch (error) {
            console.error("Error saving ticket:", error);
            alert("Erreur lors de l'enregistrement du ticket.");
        }
    });
}

function getUserName(id) {
    return Store.users.find(u => u.id === id)?.name || '-';
}

async function updateTicket(id, fieldOrUpdates, value) {
    let updates = {};
    if (typeof fieldOrUpdates === 'object') {
        updates = fieldOrUpdates;
    } else {
        updates[fieldOrUpdates] = value;
    }

    try {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.TICKETS, id, updates);
        const ticket = Store.tickets.find(t => t.id === id);
        if (ticket) Object.assign(ticket, updates);
        updateUI();
    } catch (error) {
        console.error("Error updating ticket:", error);
    }
}

function getTicketThresholds(ticket) {
    let projectId = ticket.projectId;
    // Fallback si projectId n'est pas directement sur le ticket (lié via la version)
    if (!projectId && ticket.versionId) {
        const v = Store.versions.find(ver => ver.id === ticket.versionId);
        if (v) projectId = v.projectId;
    }
    // Si toujours rien, on prend le projet sélectionné par défaut
    const project = Store.projects.find(p => p.id === projectId) || Store.projects.find(p => p.id === Store.selectedProjectId);
    
    if (!project) return { jC: 0, jE: 0 };
    const jC = round015Up(ticket.nbTestCases / project.designRatio);
    const jE = round015Up(ticket.nbTestCases / project.executionRatio);
    return { jC, jE };
}

window.onConsommeChange = (id, val) => {
    const numVal = parseFloat(val.toString().replace(',', '.')) || 0;
    const ticket = Store.tickets.find(t => t.id === id);
    if (!ticket) return;

    const { jC, jE } = getTicketThresholds(ticket);
    const updates = { consumed: numVal };
    const eps = 0.001;

    if (numVal === 0) {
        updates.statusDesign = "À faire";
        updates.statusExecution = "À exécuter";
    } else {
        // Règles Conception
        if (numVal < jC - eps) updates.statusDesign = "En cours";
        else updates.statusDesign = "Terminée";

        // Règles Exécution
        if (numVal <= jC + eps) {
            updates.statusExecution = "En attente livraison";
        } else if (numVal >= (jC + jE) - eps) {
            updates.statusExecution = "Terminée OK";
        } else {
            updates.statusExecution = "En cours d'exécution";
        }
    }

    updateTicket(id, updates);
};

window.onDesignChange = (id, val) => {
    const ticket = Store.tickets.find(t => t.id === id);
    if (!ticket) return;

    const updates = { statusDesign: val };
    if (val === "Terminée") {
        const { jC } = getTicketThresholds(ticket);
        updates.consumed = jC;
        updates.statusExecution = "En attente livraison";
    } else if (val === "À faire") {
        updates.consumed = 0;
        updates.statusExecution = "À exécuter";
    }
    updateTicket(id, updates);
};

window.onExecChange = (id, val) => {
    const ticket = Store.tickets.find(t => t.id === id);
    if (!ticket) return;

    const updates = { statusExecution: val };
    if (val === "Terminée OK") {
        const { jC, jE } = getTicketThresholds(ticket);
        updates.consumed = jC + jE;
        updates.statusDesign = "Terminée";
    } else if (val === "À exécuter") {
        const { jC } = getTicketThresholds(ticket);
        updates.consumed = jC; 
        updates.statusDesign = "Terminée";
    }
    updateTicket(id, updates);
};

window.onCommentChange = (id, val) => updateTicket(id, 'comment', val);
window.onTicketStateChange = (id, val) => updateTicket(id, 'ticketState', val);

// --- Render Projects Table ---
function renderProjectsTable() {
    if (!DOM.projectsTbody) return;
    updateFilterOptions('projects', Store.projects);
    const filtered = filterData(Store.projects, 'projects');
    const sorted = sortData(filtered, 'projects');
    DOM.projectsTbody.innerHTML = sorted.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.client || '-'}</td>
            <td><strong>${p.name}</strong></td>
            <td>${p.designRatio}</td>
            <td>${p.executionRatio}</td>
            <td>
                <button class="btn" style="padding: 0.4rem; background: var(--accent-primary);" onclick="editProject('${p.id}')" title="Modifier">
                    <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn" style="padding: 0.4rem; margin-left: 0.5rem; background: var(--danger);" onclick="deleteProject('${p.id}')" title="Supprimer">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </td>
        </tr>
    `).join('');
    updateSortIndicators('projects');
    enableColumnResizing(DOM.projectsTbody.parentElement, 'projects');
    lucide.createIcons();
}

window.editProject = (id) => {
    const p = Store.projects.find(proj => proj.id === id);
    if (p) {
        openProjectModal(p);
    }
};

window.deleteProject = async (id) => {
    if (!confirm("Supprimer ce projet et TOUTES ses données ?")) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PROJECTS, id);
        await loadStore();
        renderProjectsTable();

        if (currentProjectId === id) {
            currentProjectId = ''; // Invalider le projet courant
        }
        validateAndSaveState();
        populateHeaderSelects();
        updateUI();
    } catch (error) {
        console.error("Error deleting project:", error);
    }
};

// --- Render Versions Table ---
function renderVersionsTable() {
    if (!DOM.versionsTbody) return;
    updateFilterOptions('versions', Store.versions);
    const filtered = filterData(Store.versions, 'versions');
    const sorted = sortData(filtered, 'versions');
    DOM.versionsTbody.innerHTML = sorted.map(v => {
        const proj = Store.projects.find(p => p.id === v.projectId);
        const pName = proj ? proj.name : 'Inconnu';
        
        return `
            <tr>
                <td>${v.id}</td>
                <td><strong>${v.name}</strong></td>
                <td>${pName}</td>
                <td>${v.deliveryDateRecette ? new Date(v.deliveryDateRecette).toLocaleDateString('fr-FR') : '-'}</td>
                <td>${v.deliveryDateClient ? new Date(v.deliveryDateClient).toLocaleDateString('fr-FR') : '-'}</td>
                <td>
                    <button class="btn" style="padding: 0.4rem; background: var(--accent-primary);" onclick="editVersion('${v.id}')" title="Modifier">
                        <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                    </button>
                    <button class="btn" style="padding: 0.4rem; margin-left: 0.5rem; background: var(--danger);" onclick="deleteVersion('${v.id}')" title="Supprimer">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    updateSortIndicators('versions');
    enableColumnResizing(DOM.versionsTbody.parentElement, 'versions');
    lucide.createIcons();
}

window.editVersion = (id) => {
    const v = Store.versions.find(ver => ver.id === id);
    if (v) {
        openVersionModal(v);
    }
};

window.deleteVersion = async (id) => {
    if (!confirm("Supprimer cette version ?")) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.VERSIONS, id);
        await loadStore();
        renderVersionsTable();

        if (currentVersionId === id) {
            currentVersionId = ''; // Invalider la version courante
        }
        validateAndSaveState();
        updateVersionSelect();
        updateUI();
    } catch (error) {
        console.error("Error deleting version:", error);
    }
};

// --- Render Users Table ---
function renderUsersTable() {
    if (!DOM.usersTbody) return;
    updateFilterOptions('users', Store.users);
    const filtered = filterData(Store.users, 'users');
    const sorted = sortData(filtered, 'users');
    DOM.usersTbody.innerHTML = sorted.map(u => `
        <tr>
            <td>${u.id}</td>
            <td><strong>${u.name}</strong></td>
            <td><span class="badge ${u.role === 'Admin' ? 'badge-prio-haute' : 'badge-prio-basse'}">${u.role}</span></td>
            <td>
                <button class="btn" style="padding: 0.4rem; background: var(--accent-primary);" onclick="editUser('${u.id}')" title="Modifier">
                    <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn" style="padding: 0.4rem; margin-left: 0.5rem; background: var(--danger);" onclick="deleteUser('${u.id}')" title="Supprimer">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </td>
        </tr>
    `).join('');
    updateSortIndicators('users');
    enableColumnResizing(DOM.usersTbody.parentElement, 'users');
    lucide.createIcons();
}

window.editUser = (id) => {
    const u = Store.users.find(usr => usr.id === id);
    if (u) {
        DOM.userForm.reset();
        DOM.userModalTitle.textContent = "Modifier l'Utilisateur";
        DOM.uId.value = u.id;
        DOM.uiName.value = u.name;
        DOM.uRole.value = u.role;
        DOM.userModal.classList.add('show');
    }
};

window.deleteUser = async (id) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.USERS, id);
        await loadStore();
        renderUsersTable();
        populateFormSelects();
        updateFormUsers();
        renderTicketsTable();
    } catch (error) {
        console.error("Error deleting user:", error);
    }
};

// --- Render Main Table ---
function renderTicketsTable() {
    const project = Store.projects.find(p => p.id === currentProjectId);
    if (!project) {
        console.warn("RENDER_TICKETS: Missing project for ID", currentProjectId);
        DOM.ticketsTbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding: 2rem; color: var(--text-muted);">Veuillez créer un projet pour commencer.</td></tr>';
        return;
    }
    
    console.log(`RENDER_TICKETS: Filtering for version [${currentVersionId}]. Total tickets in Store: ${Store.tickets.length}`);
    if (Store.tickets.length > 0) {
        console.log("DEBUG_TICKET_SAMPLE:", Store.tickets[0]);
    }
    
    let viewTickets = Store.tickets.filter(t => {
        const match = String(t.versionId) === String(currentVersionId);
        return match;
    });
    
    console.log(`RENDER_TICKETS: Filtered tickets: ${viewTickets.length}`);

    if (filterUserId) {
        viewTickets = viewTickets.filter(t => t.assignDesignId === filterUserId || t.assignExecutionId === filterUserId);
    }

    const filtered = filterData(viewTickets, 'tickets');
    updateFilterOptions('tickets', viewTickets); // Populate based on current version's tickets
    const sorted = sortData(filtered, 'tickets');

    // Calcul dynamique des largeurs basées sur le contenu possible
    const designOptions = ['À faire', 'En cours', 'Terminée'];
    const execOptions = ['À exécuter', 'En attente livraison', 'Bloquée', 'En cours d\'exécution', 'Terminée OK', 'Terminée KO'];
    const wState = getRequiredWidth(project.ticketStates || []);
    const wDesign = getRequiredWidth(designOptions);
    const wExec = getRequiredWidth(execOptions);
    const wConso = getRequiredWidth(['Consommé']);
    const wJH = getRequiredWidth(['J/H (E)']); // Identique pour C et E
    const wRAF = getRequiredWidth(['RAF']);

    // Application dynamique sur les en-têtes (On force la largeur pour éviter le squeeze)
    const thState = document.querySelector('th[data-col="ticketState"]');
    if (thState) { thState.style.width = `${wState}px`; thState.style.minWidth = `${wState}px`; }
    const thDesign = document.querySelector('th[data-col="statusDesign"]');
    if (thDesign) { thDesign.style.width = `${wDesign}px`; thDesign.style.minWidth = `${wDesign}px`; }
    const thExec = document.querySelector('th[data-col="statusExecution"]');
    if (thExec) { thExec.style.width = `${wExec}px`; thExec.style.minWidth = `${wExec}px`; }
    const thConso = document.querySelector('th[data-col="consumed"]');
    if (thConso) { thConso.style.width = `${wConso}px`; thConso.style.minWidth = `${wConso}px`; }
    const thJHC = document.querySelector('th[data-col="jConception"]');
    if (thJHC) { thJHC.style.width = `${wJH}px`; thJHC.style.minWidth = `${wJH}px`; }
    const thJHE = document.querySelector('th[data-col="jExecution"]');
    if (thJHE) { thJHE.style.width = `${wJH}px`; thJHE.style.minWidth = `${wJH}px`; }
    const thRAF = document.querySelector('th[data-col="raf"]');
    if (thRAF) { thRAF.style.width = `${wRAF}px`; thRAF.style.minWidth = `${wRAF}px`; }

    DOM.ticketsTbody.innerHTML = sorted.map(t => {
        const calcs = getCalculations(t, project);

        const execOptions = ['En attente livraison', 'Bloquée', 'À exécuter', 'En cours d\'exécution', 'Terminée OK', 'Terminée KO'];
        const designOptions = ['À faire', 'En cours', 'Terminée'];

        const getStatusClass = (status) => {
            if (status.includes('OK') || status === 'Terminée') return 'done-ok';
            if (status.includes('KO')) return 'done-ko';
            if (status === 'Bloquée') return 'blocked';
            return '';
        };

        return `
            <tr>
                <td class="sticky-left-1">
                    <div style="display: flex; gap: 0.2rem;">
                        <button class="btn" style="padding: 0.2rem; background: var(--accent-primary);" onclick="editTicket('${t.id}')" title="Modifier">
                            <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn" style="padding: 0.2rem; background: var(--danger);" onclick="deleteTicket('${t.id}')" title="Supprimer">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </td>
                <td class="sticky-left-2" style="font-weight:600; color:var(--text-muted);">#${t.number}</td>
                <td>${t.feature}</td>
                <td><span style="padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.1); font-size:11px">${t.type}</span></td>
                <td>${t.priority}</td>
                <td>${getUserName(t.assignDesignId)}</td>
                <td>${getUserName(t.assignExecutionId)}</td>
                <td>${t.nbTestCases}</td>
                <td style="min-width: ${wState}px">
                    <select class="status-select ${getStatusClass(t.ticketState)}" onchange="onTicketStateChange('${t.id}', this.value)">
                        ${(project.ticketStates || []).map(o => `<option value="${o}" ${t.ticketState === o ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td style="color:var(--accent-primary); font-weight:600">${calcs.jConception}</td>
                <td style="color:var(--accent-secondary); font-weight:600">${calcs.jExecution}</td>
                <td>
                    <input type="text" class="editable-field" value="${formatFrenchFloat(t.consumed)}" onchange="onConsommeChange('${t.id}', this.value)">
                </td>
                <td style="font-weight:700">${calcs.raf}</td>
                <td style="width: ${wDesign}px; min-width: ${wDesign}px">
                    <select class="status-select ${getStatusClass(t.statusDesign)}" onchange="onDesignChange('${t.id}', this.value)">
                        ${designOptions.map(o => `<option value="${o}" ${t.statusDesign === o ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td style="width: ${wExec}px; min-width: ${wExec}px">
                    <select class="status-select ${getStatusClass(t.statusExecution)}" onchange="onExecChange('${t.id}', this.value)">
                        ${execOptions.map(o => `<option value="${o}" ${t.statusExecution === o ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="editable-field" style="text-align:left;" value="${t.comment}" onchange="onCommentChange('${t.id}', this.value)">
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
    updateSortIndicators('tickets');
    enableColumnResizing(DOM.ticketsTbody.parentElement, 'tickets');
    updateStickyOffsets();
}

/**
 * Recalcule dynamiquement le left de sticky-left-2
 * pour chaque table indépendamment.
 */
function updateStickyOffsets() {
    document.querySelectorAll('.data-table').forEach(table => {
        const ref = table.querySelector('th.sticky-left-1');
        if (!ref) return;
        
        // Utilisation de getBoundingClientRect pour une précision au sous-pixel
        // On soustrait un infime montant (0.2px) pour garantir un recouvrement parfait
        // et boucher toute fuite visuelle.
        const rect = ref.getBoundingClientRect();
        const w = (rect.width - 0.2).toFixed(2);
        
        table.querySelectorAll('.sticky-left-2').forEach(el => {
            el.style.left = w + 'px';
        });
    });
}

window.editTicket = (id) => {
    const t = Store.tickets.find(tick => tick.id === id);
    if (t) {
        updateFormStates();
        DOM.ticketForm.reset();
        const mTitle = document.getElementById('modalTitle');
        if (mTitle) mTitle.textContent = "Modifier le Ticket";

        DOM.tId.value = t.id;
        DOM.fFeat.value = t.feature;
        DOM.fType.value = t.type;
        DOM.fNum.value = t.number;
        DOM.fPrio.value = t.priority;
        DOM.fAssC.value = t.assignDesignId || '';
        DOM.fAssE.value = t.assignExecutionId || '';
        DOM.fTests.value = t.nbTestCases;
        DOM.fState.value = t.ticketState;

        updateFormVersions();
        DOM.fVersion.value = t.versionId || currentVersionId;

        updateFeatureDatalist();

        DOM.modal.classList.add('show');
    }
};

window.deleteTicket = async (id) => {
    if (confirm("Voulez-vous vraiment supprimer ce ticket ?")) {
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TICKETS, id);
            await loadStore();
            updateUI();
        } catch (error) {
            console.error("Error deleting ticket:", error);
        }
    }
};

// --- Calcule les jours fériés français pour une année donnée (incluant jours mobiles) ---
function getFrenchHolidays(year) {
    const holidays = [
        new Date(year, 0, 1),   // Jour de l'an
        new Date(year, 4, 1),   // Fête du Travail
        new Date(year, 4, 8),   // Victoire 1945
        new Date(year, 6, 14),  // Fête Nationale
        new Date(year, 7, 15),  // Assomption
        new Date(year, 10, 1),  // Toussaint
        new Date(year, 10, 11), // Armistice 1918
        new Date(year, 11, 25)  // Noël
    ];

    // Algorithme de Meeus/Jones/Butcher pour Pâques
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    const month = Math.floor(n / 31) - 1;
    const day = (n % 31) + 1;

    const easter = new Date(year, month, day);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    
    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    
    const pentecostMonday = new Date(easter);
    pentecostMonday.setDate(easter.getDate() + 50);

    holidays.push(easterMonday, ascension, pentecostMonday);
    
    return holidays.map(d => {
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    });
}

// --- Ajoute des jours ouvrés à une date (float) ---
function addWorkingDays(startDate, daysToAdd) {
    if (daysToAdd <= 0) return new Date(startDate);
    
    let result = new Date(startDate);
    let remainingDays = daysToAdd;
    const cachedHolidays = {};

    // Sécurité : on arrondit à l'entier supérieur pour la date de livraison
    const daysToIterate = Math.ceil(daysToAdd);

    let added = 0;
    while (added < daysToIterate) {
        result.setDate(result.getDate() + 1);
        const year = result.getFullYear();
        if (!cachedHolidays[year]) cachedHolidays[year] = getFrenchHolidays(year);
        
        const dayOfWeek = result.getDay();
        const timeAtMidnight = new Date(result).setHours(0, 0, 0, 0);
        
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !cachedHolidays[year].includes(timeAtMidnight)) {
            added++;
        }
    }
    return result;
}

// --- Calcul précis des jours ouvrés (float) entre deux dates (hors weekends/fériés) ---
function getWorkingDaysPrecise(startDate, endDate) {
    if (startDate >= endDate) return 0;
    
    let days = 0;
    let tempDate = new Date(startDate);
    const cachedHolidays = {};
    
    while (tempDate < endDate) {
        const nextDay = new Date(tempDate);
        nextDay.setDate(tempDate.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0); 
        
        let chunkEnd = nextDay < endDate ? nextDay : endDate;
        
        const year = tempDate.getFullYear();
        if (!cachedHolidays[year]) cachedHolidays[year] = getFrenchHolidays(year);
        
        const dayOfWeek = tempDate.getDay();
        const timeAtMidnight = new Date(tempDate).setHours(0, 0, 0, 0);

        // Ouvré si ni Dimanche(0), ni Samedi(6), ni férié
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !cachedHolidays[year].includes(timeAtMidnight)) {
            days += (chunkEnd - tempDate) / (1000 * 3600 * 24);
        }
        
        tempDate = nextDay;
    }
    return days;
}

// --- Render Dashboard ---
function renderDashboard() {
    const project = Store.projects.find(p => p.id === currentProjectId);
    if (!project) return;

    // Update dashboard header info
    if (DOM.dashProjectName) {
        const clientPrefix = project.client ? `${project.client} - ` : '';
        DOM.dashProjectName.textContent = `${clientPrefix}${project.name}`;
    }
    const currentVersion = Store.versions.find(v => v.id === currentVersionId);
    if (DOM.dashVersionName) DOM.dashVersionName.textContent = currentVersion ? currentVersion.name : '-';

    const viewTickets = Store.tickets.filter(t => t.versionId === currentVersionId);

    let totalRaf = 0;
    let rafC_total = 0;
    let rafE_total = 0;
    let totalJConception = 0;
    let doneJConception = 0;
    let totalJExecution = 0;
    let doneJExecution = 0;

    let nbUS = 0;
    let nbBugs = 0;
    let nbTasks = 0;

    const execByType = {};
    const designByType = {};
    const execByFeat = {};
    const designByFeat = {};
    
    const activeExecStatuses = new Set();
    const activeDesignStatuses = new Set();
    const featureStats = {}; // Détails par périmètre (us, bug, task)
    
    // Initialisation des variables de calcul (essentielles)
    const userRaf = {};
    const statusCount = {}; // Pour le graphique global Doughnut

    viewTickets.forEach(t => {
        const calcs = getCalculations(t, project);
        totalRaf += calcs.rawRaf;
        rafC_total += calcs.rafC;
        rafE_total += calcs.rafE;

        // Stats by Type and Feature
        if (!execByType[t.type]) execByType[t.type] = {};
        if (!designByType[t.type]) designByType[t.type] = {};
        if (!execByFeat[t.feature]) execByFeat[t.feature] = {};
        if (!designByFeat[t.feature]) designByFeat[t.feature] = {};

        const sE = t.statusExecution || 'À exécuter';
        const sD = t.statusDesign || 'À faire';

        execByType[t.type][sE] = (execByType[t.type][sE] || 0) + 1;
        designByType[t.type][sD] = (designByType[t.type][sD] || 0) + 1;
        execByFeat[t.feature][sE] = (execByFeat[t.feature][sE] || 0) + 1;
        designByFeat[t.feature][sD] = (designByFeat[t.feature][sD] || 0) + 1;

        activeExecStatuses.add(sE);
        activeDesignStatuses.add(sD);
        
        // Comptage global pour le Doughnut
        statusCount[sE] = (statusCount[sE] || 0) + 1;

        // Type counting
        const typeNormalized = (t.type || "").toUpperCase();
        if (typeNormalized.includes("US")) nbUS++;
        else if (typeNormalized.includes("BUG")) nbBugs++;
        else if (typeNormalized.includes("TÂCHE") || typeNormalized.includes("TACHE")) nbTasks++;

        // Project overall progress
        totalJConception += calcs.rawJConception;
        totalJExecution += calcs.rawJExecution;

        // Workload Attribution
        if (t.assignDesignId) {
            if (!userRaf[t.assignDesignId]) userRaf[t.assignDesignId] = { c: 0, e: 0 };
            userRaf[t.assignDesignId].c += calcs.rafC;
        }
        if (t.assignExecutionId) {
            if (!userRaf[t.assignExecutionId]) userRaf[t.assignExecutionId] = { c: 0, e: 0 };
            userRaf[t.assignExecutionId].e += calcs.rafE;
        }

        // Feature stats
        const f = t.feature || 'Sans périmètre';
        if (!featureStats[f]) featureStats[f] = { us: 0, bug: 0, task: 0, total: 0 };
        featureStats[f].total++;
        if (typeNormalized.includes("US")) featureStats[f].us++;
        else if (typeNormalized.includes("BUG")) featureStats[f].bug++;
        else featureStats[f].task++;
    });

    const statusObj = {
        execByType, designByType, execByFeat, designByFeat,
        activeExecStatuses: Array.from(activeExecStatuses),
        activeDesignStatuses: Array.from(activeDesignStatuses)
    };

    doneJConception = Math.max(0, totalJConception - rafC_total);
    doneJExecution = Math.max(0, totalJExecution - rafE_total);

    const advC = totalJConception > 0 ? (doneJConception / totalJConception) * 100 : 0;
    const advE = totalJExecution > 0 ? (doneJExecution / totalJExecution) * 100 : 0;
    
    const totalJH = totalJConception + totalJExecution;
    const doneTotal = Math.max(0, totalJH - totalRaf);
    const advTotal = totalJH > 0 ? (doneTotal / totalJH) * 100 : 0;

    // Update KPI values
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    safeSetText('kpiNbUS', nbUS);
    safeSetText('kpiNbBugs', nbBugs);
    safeSetText('kpiNbTasks', nbTasks);
    safeSetText('kpiTotalTickets', viewTickets.length);

    safeSetText('kpiJH_C', formatFrenchFloat(totalJConception));
    safeSetText('kpiJH_E', formatFrenchFloat(totalJExecution));
    safeSetText('kpiJH_Total', formatFrenchFloat(totalJConception + totalJExecution));

    safeSetText('kpiRaf_C', formatFrenchFloat(rafC_total));
    safeSetText('kpiRaf_E', formatFrenchFloat(rafE_total));
    safeSetText('kpiTotalRaf', formatFrenchFloat(totalRaf));

    safeSetText('kpiAdvC', advC.toFixed(0) + '%');
    safeSetText('kpiAdvE', advE.toFixed(0) + '%');
    safeSetText('kpiAdvTotal', advTotal.toFixed(0) + '%');

    // --- Render Feature Breakdown Cards ---
    const breakdownEl = document.getElementById('dashFeatureBreakdown');
    if (breakdownEl) {
        const featEntries = Object.entries(featureStats).sort((a,b) => b[1].total - a[1].total);
        breakdownEl.innerHTML = featEntries.map(([name, s]) => `
            <div class="kpi-card" style="padding: 1rem; flex-direction: column; align-items: flex-start; gap: 0.75rem; border: 1px solid rgba(0,0,0,0.03); background: rgba(255,255,255,0.4);">
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; gap: 0.5rem;">
                    <h3 style="margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${name}">
                        ${name}
                    </h3>
                    <span style="background: var(--accent-primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; white-space: nowrap;">
                        ${s.total}
                    </span>
                </div>
                <div style="display: flex; gap: 0.8rem; color: var(--text-muted); font-size: 0.75rem; width: 100%;">
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex: 1;" title="User Stories">
                        <i data-lucide="file-text" style="width: 14px; height: 14px; color: #6366f1;"></i>
                        <span style="font-weight: 600; color: var(--text-main);">${s.us}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex: 1;" title="Bugs">
                        <i data-lucide="bug" style="width: 14px; height: 14px; color: #ef4444;"></i>
                        <span style="font-weight: 600; color: var(--text-main);">${s.bug}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex: 1;" title="Tâches">
                        <i data-lucide="check-square" style="width: 14px; height: 14px; color: #f59e0b;"></i>
                        <span style="font-weight: 600; color: var(--text-main);">${s.task}</span>
                    </div>
                </div>
            </div>
        `).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // --- Delivery Risk Logic ---
    const riskIcon = document.getElementById('dashRiskIcon');
    const riskText = document.getElementById('dashRiskText');
    
    if (riskIcon && riskText && currentVersion) {
        const now = new Date();
        
        const parseDate = (dStr) => {
            if (!dStr) return null;
            const d = new Date(dStr);
            // On fixe l'échéance à 17h00 du jour j
            d.setHours(17, 0, 0, 0);
            return isNaN(d.getTime()) ? null : d;
        };

        const dRecette = parseDate(currentVersion.deliveryDateRecette);
        const dClient = parseDate(currentVersion.deliveryDateClient);
        const nbMembers = project.userIds ? Math.max(1, project.userIds.length) : 1;

        let status = 'OK';
        let msg = 'Dans les temps';
        const totalPointsC = rafC_total;
        const totalPointsE = rafE_total;

        // Debug log for PM
        console.log(`[Risk Check] Version: ${currentVersion.name} | RAF Total: ${totalRaf} | Members: ${nbMembers}`);

        if (dClient) {
            if (dRecette) {
                if (now > dRecette) {
                    // Scenario 1: On a dépassé la date de recette
                    const daysRemaining = getWorkingDaysPrecise(now, dClient);
                    const daysNeeded = totalRaf / nbMembers;
                    console.log(`[Risk Check] Mode: Post-Recette | DaysRem: ${daysRemaining.toFixed(2)} (ouvrés) | DaysReq: ${daysNeeded.toFixed(2)}`);
                    if (daysNeeded > daysRemaining) {
                        status = 'KO';
                        msg = `Retard estimé à ${round05Up(daysNeeded - daysRemaining).toFixed(2)} jours`;
                    }
                } else {
                    // Scenario 2: Avant la recette
                    const daysToRecette = getWorkingDaysPrecise(now, dRecette);
                    const daysNeededForRecette = totalPointsC / nbMembers;
                    
                    const daysToClient = getWorkingDaysPrecise(dRecette, dClient);
                    const daysNeededForClient = totalPointsE / nbMembers;

                    console.log(`[Risk Check] Mode: Avant-Recette | ToRecette: ${daysToRecette.toFixed(2)} ouvrés (Req: ${daysNeededForRecette.toFixed(2)}) | ToClientFromRecette: ${daysToClient.toFixed(2)} ouvrés (Req: ${daysNeededForClient.toFixed(2)})`);

                    if (daysNeededForRecette > daysToRecette) {
                        status = 'KO';
                        msg = `Retard Recette estimé à ${round05Up(daysNeededForRecette - daysToRecette).toFixed(2)} jours`;
                    } else if (daysNeededForClient > daysToClient) {
                        status = 'KO';
                        msg = `Retard Client estimé à ${round05Up(daysNeededForClient - daysToClient).toFixed(2)} jours`;
                    }
                }
            } else {
                // Scenario 3: Pas de date de recette
                const daysRemaining = getWorkingDaysPrecise(now, dClient);
                const daysNeeded = totalRaf / nbMembers;
                console.log(`[Risk Check] Mode: Global | DaysRem: ${daysRemaining.toFixed(2)} (ouvrés) | DaysReq: ${daysNeeded.toFixed(2)}`);
                if (daysNeeded > daysRemaining) {
                    status = 'KO';
                    msg = `Retard estimé à ${round05Up(daysNeeded - daysRemaining).toFixed(2)} jours`;
                }
            }
        } else {
            msg = "Date de livraison non définie";
            status = 'PENDING';
        }

        // --- Populate delivery date (always shown) ---
        const dashDeliveryDate = document.getElementById('dashDeliveryDate');
        const dashMarginSlot = document.getElementById('dashMarginSlot');
        const dashMarginDays = document.getElementById('dashMarginDays');
        const dashPossibleDeliverySlot = document.getElementById('dashPossibleDeliverySlot');
        const dashPossibleDeliveryDate = document.getElementById('dashPossibleDeliveryDate');

        if (dashDeliveryDate) {
            if (dClient) {
                dashDeliveryDate.textContent = dClient.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } else {
                dashDeliveryDate.textContent = 'Non définie';
                dashDeliveryDate.style.color = '#9ca3af';
            }
        }

        // --- Compute margin (always, for any status with a delivery date) ---
        let marginDays = null;
        if (dClient) {
            const daysNeeded = totalRaf / nbMembers;
            marginDays = getWorkingDaysPrecise(now, dClient) - daysNeeded;
        }

        // --- Affichage de la marge (toujours si date définie) ---
        if (dashMarginSlot && dashMarginDays) {
            if (marginDays !== null) {
                dashMarginSlot.style.display = 'flex';
                const marginRounded = Math.abs(Math.floor(marginDays * 10) / 10);
                if (marginDays >= 0) {
                    dashMarginSlot.style.background = 'rgba(16, 185, 129, 0.08)';
                    dashMarginDays.style.color = '#10b981';
                    dashMarginDays.textContent = `+${marginRounded.toFixed(1)} j ouvrés`;
                } else {
                    dashMarginSlot.style.background = 'rgba(239, 68, 68, 0.08)';
                    dashMarginDays.style.color = '#ef4444';
                    dashMarginDays.textContent = `-${marginRounded.toFixed(1)} j ouvrés`;
                }
            } else {
                dashMarginSlot.style.display = 'none';
            }
        }

        // --- Affichage Livraison Possible ---
        if (dashPossibleDeliverySlot && dashPossibleDeliveryDate) {
            const daysNeeded = totalRaf / nbMembers;
            // On calcule toujours à partir de "now"
            const possibleDate = addWorkingDays(now, daysNeeded);
            
            if (totalRaf > 0) {
                dashPossibleDeliverySlot.style.display = 'flex';
                dashPossibleDeliveryDate.textContent = possibleDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                
                // Si la date possible dépasse la date client -> Alerte
                if (dClient && possibleDate > dClient) {
                    dashPossibleDeliverySlot.style.background = 'rgba(239, 68, 68, 0.08)';
                    dashPossibleDeliveryDate.style.color = '#ef4444';
                } else {
                    dashPossibleDeliverySlot.style.background = 'rgba(245, 158, 11, 0.08)';
                    dashPossibleDeliveryDate.style.color = '#f59e0b';
                }
            } else if (viewTickets.length > 0 && totalRaf === 0) {
                dashPossibleDeliverySlot.style.display = 'flex';
                dashPossibleDeliveryDate.textContent = "Terminée";
                dashPossibleDeliverySlot.style.background = 'rgba(16, 185, 129, 0.08)';
                dashPossibleDeliveryDate.style.color = '#10b981';
            } else {
                dashPossibleDeliverySlot.style.display = 'none';
            }
        }

        // Update UI
        if (status === 'OK') {
            riskIcon.style.background = 'rgba(16, 185, 129, 0.1)';
            riskIcon.style.color = '#10b981';
            riskIcon.innerHTML = '<i data-lucide="check-circle"></i>';
            riskText.style.color = '#10b981';
            riskText.textContent = msg;
        } else if (status === 'KO') {
            riskIcon.style.background = 'rgba(239, 68, 68, 0.1)';
            riskIcon.style.color = '#ef4444';
            riskIcon.innerHTML = '<i data-lucide="alert-triangle"></i>';
            riskText.style.color = '#ef4444';
            riskText.textContent = msg;
        } else {
            riskIcon.style.background = 'rgba(99, 102, 241, 0.1)';
            riskIcon.style.color = '#6366f1';
            riskIcon.innerHTML = '<i data-lucide="help-circle"></i>';
            riskText.style.color = '#6366f1';
            riskText.textContent = msg;
        }

        lucide.createIcons();
    }


    // Update progress bars
    const barC = document.getElementById('kpiAdvCBar');
    const barE = document.getElementById('kpiAdvEBar');
    const barTotal = document.getElementById('kpiAdvTotalBar');
    if (barC) barC.style.width = advC.toFixed(0) + '%';
    if (barE) barE.style.width = advE.toFixed(0) + '%';
    if (barTotal) barTotal.style.width = advTotal.toFixed(0) + '%';

    // Workload data for chart (Stacked Bar)
    const workloadPairs = Object.entries(userRaf).map(([uId, obj]) => ({
        name: getUserName(uId),
        c: round015Up(obj.c),
        e: round015Up(obj.e),
        total: round015Up(obj.c + obj.e)
    }));
    workloadPairs.sort((a, b) => b.total - a.total);

    renderCharts(statusObj, workloadPairs, { advC, advE, totalJConception, totalJExecution, doneJConception, doneJExecution }, viewTickets.length, statusCount);
}

function renderCharts(statusObj, workloadPairs, progressData, totalTickets, statusCount) {
    const STATUS_COLORS = {
        'Terminée': ['#10b981', '#059669'],
        'Terminée OK': ['#10b981', '#059669'],
        'Terminée KO': ['#ef4444', '#dc2626'],
        'En cours': ['#3b82f6', '#2563eb'],
        'En cours d\'exécution': ['#3b82f6', '#2563eb'],
        'Bloquée': ['#f43f5e', '#e11d48'],
        'À faire': ['#94a3b8', '#64748b'],
        'À exécuter': ['#94a3b8', '#64748b'],
        'En attente livraison': ['#f59e0b', '#d97706'],
        'Rejeté': ['#1e293b', '#0f172a']
    };

    const getStatusColor = (status, isStart = true) => {
        if (STATUS_COLORS[status]) return isStart ? STATUS_COLORS[status][0] : STATUS_COLORS[status][1];
        // Generate a deterministic color if unknown
        let hash = 0;
        for (let i = 0; i < status.length; i++) hash = status.charCodeAt(i) + ((hash << 5) - hash);
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return "#" + "00000".substring(0, 6 - c.length) + c;
    };
    // ---- Color palette with gradients ----
    const createGradient = (ctx, colorStart, colorEnd, horizontal = false) => {
        const chart = ctx.chart;
        const { top, bottom, left, right } = chart.chartArea || { top: 0, bottom: 400, left: 0, right: 400 };
        const gradient = horizontal
            ? ctx.chart.ctx.createLinearGradient(left, 0, right, 0)
            : ctx.chart.ctx.createLinearGradient(0, bottom, 0, top);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);
        return gradient;
    };

    const textCol = '#1e293b';
    const gridCol = 'rgba(0,0,0,0.04)';

    // ---- Shared chart options ----
    const modernTooltip = {
        backgroundColor: '#1e293b',
        titleColor: '#fff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        titleFont: { family: 'Inter', size: 13, weight: '600' },
        bodyFont: { family: 'Inter', size: 12 },
        displayColors: true,
        boxPadding: 4
    };

    const modernScales = (stacked = false) => ({
        x: {
            stacked,
            grid: { color: gridCol, drawBorder: false, borderDash: [3, 3] },
            ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#64748b' }
        },
        y: {
            stacked,
            grid: { color: gridCol, drawBorder: false, borderDash: [3, 3] },
            ticks: { stepSize: 1, precision: 0, font: { family: 'Inter', size: 11, weight: '500' }, color: '#64748b' }
        }
    });

    const applyChartConf = (id, type, data, options) => {
        if (chartInstances[id]) { chartInstances[id].destroy(); }
        const canvasEl = document.getElementById(id);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        Chart.defaults.color = textCol;
        Chart.defaults.font.family = 'Inter';
        chartInstances[id] = new Chart(ctx, { type, data, options });
    };

    // Helper for stacked bar charts
    const applyStackedStatusChart = (id, labels, dataMap, activeStatuses) => {
        const datasets = activeStatuses.map(status => {
            return {
                label: status,
                data: labels.map(l => dataMap[l][status] || 0),
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, getStatusColor(status), getStatusColor(status, false)); } catch (e) { return getStatusColor(status); }
                },
                borderRadius: 8,
                borderSkipped: false
            };
        }).filter(ds => ds.data.some(v => v > 0)); // Only show if at least one bar has this status

        applyChartConf(id, 'bar', { labels, datasets }, {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: modernTooltip,
                legend: { labels: { font: { family: 'Inter', size: 10 }, usePointStyle: true, pointStyle: 'rectRounded', padding: 12 } }
            },
            scales: modernScales(true)
        });
    };

    // Design Charts
    const typeLabels = Object.keys(statusObj.designByType);
    const featLabels = Object.keys(statusObj.designByFeat);
    
    applyStackedStatusChart('chartTypeDesign', typeLabels, statusObj.designByType, statusObj.activeDesignStatuses);
    applyStackedStatusChart('chartFeatureDesign', featLabels, statusObj.designByFeat, statusObj.activeDesignStatuses);

    // Execution Charts
    const typeLabelsExec = Object.keys(statusObj.execByType);
    const featLabelsExec = Object.keys(statusObj.execByFeat);

    applyStackedStatusChart('chartTypeExec', typeLabelsExec, statusObj.execByType, statusObj.activeExecStatuses);
    applyStackedStatusChart('chartFeatureExec', featLabelsExec, statusObj.execByFeat, statusObj.activeExecStatuses);

    // ==== Chart 3: Progress Conception vs Exécution (grouped bar) ====
    applyChartConf('chartProgress', 'bar', {
        labels: ['Conception', 'Exécution'],
        datasets: [
            {
                label: 'Réalisé (J/h)',
                data: [progressData.doneJConception, progressData.doneJExecution],
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#34d399', '#10b981'); } catch (e) { return '#10b981'; }
                },
                borderRadius: 8,
                borderSkipped: false
            },
            {
                label: 'Restant (J/h)',
                data: [
                    Math.max(0, progressData.totalJConception - progressData.doneJConception),
                    Math.max(0, progressData.totalJExecution - progressData.doneJExecution)
                ],
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#cbd5e1', '#94a3b8'); } catch (e) { return '#94a3b8'; }
                },
                borderRadius: 8,
                borderSkipped: false
            }
        ]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: modernTooltip,
            legend: { labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyle: 'rectRounded', padding: 16 } }
        },
        scales: modernScales(true)
    });

    // ==== Chart 4: Doughnut with center text ====
    const statusLabels = Object.keys(statusCount);
    const doughnutColors = [
        '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#8b5cf6',
        '#ec4899', '#14b8a6', '#f97316', '#64748b'
    ];

    // Center text plugin
    const centerTextPlugin = {
        id: 'centerText',
        afterDraw(chart) {
            if (chart.config.type !== 'doughnut') return;
            const { ctx, chartArea: { width, height, top } } = chart;
            ctx.save();
            const centerX = width / 2 + chart.chartArea.left;
            const centerY = height / 2 + top;

            ctx.font = '800 1.75rem Inter';
            ctx.fillStyle = '#1e293b';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(totalTickets, centerX, centerY - 8);

            ctx.font = '500 0.7rem Inter';
            ctx.fillStyle = '#64748b';
            ctx.fillText('tickets', centerX, centerY + 14);
            ctx.restore();
        }
    };

    applyChartConf('chartStatus', 'doughnut', {
        labels: statusLabels,
        datasets: [{
            data: statusLabels.map(l => statusCount[l]),
            backgroundColor: statusLabels.map((_, i) => doughnutColors[i % doughnutColors.length]),
            borderWidth: 0,
            hoverOffset: 8
        }]
    }, {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
            tooltip: modernTooltip,
            legend: {
                position: 'bottom',
                labels: {
                    font: { family: 'Inter', size: 11 },
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 16
                }
            }
        }
    });

    // Register the center text plugin for the doughnut specifically
    if (chartInstances['chartStatus']) {
        chartInstances['chartStatus'].destroy();
        const canvasEl = document.getElementById('chartStatus');
        if (canvasEl) {
            const ctx = canvasEl.getContext('2d');
            chartInstances['chartStatus'] = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: statusLabels,
                    datasets: [{
                        data: statusLabels.map(l => statusCount[l]),
                        backgroundColor: statusLabels.map((_, i) => doughnutColors[i % doughnutColors.length]),
                        borderWidth: 0,
                        hoverOffset: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        tooltip: modernTooltip,
                        legend: {
                            position: 'bottom',
                            labels: {
                                font: { family: 'Inter', size: 11 },
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 16
                            }
                        }
                    }
                },
                plugins: [centerTextPlugin]
            });
        }
    }

    // ==== Chart 5: Workload horizontal stacked bar ====
    const workloadLabels = workloadPairs.map(w => w.name);
    
    applyChartConf('chartWorkload', 'bar', {
        labels: workloadLabels,
        datasets: [
            {
                label: 'Conception',
                data: workloadPairs.map(w => w.c),
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#34d399', '#10b981', true); } catch (e) { return '#10b981'; }
                },
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 28
            },
            {
                label: 'Exécution',
                data: workloadPairs.map(w => w.e),
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#38bdf8', '#0ea5e9', true); } catch (e) { return '#0ea5e9'; }
                },
                borderRadius: 4,
                borderSkipped: false,
                barThickness: 28
            }
        ]
    }, {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            tooltip: {
                ...modernTooltip,
                callbacks: {
                    label: (context) => {
                        return `${context.dataset.label}: ${context.parsed.x} J/h`;
                    }
                }
            },
            legend: { 
                display: true, 
                position: 'bottom',
                labels: { font: { family: 'Inter', size: 11 }, usePointStyle: true, pointStyle: 'rectRounded' }
            }
        },
        scales: {
            x: {
                stacked: true,
                grid: { color: gridCol, drawBorder: false, borderDash: [3, 3] },
                ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#64748b' }
            },
            y: {
                stacked: true,
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 12, weight: '600' }, color: '#1e293b' }
            }
        }
    });
}

function updateUI() {
    renderTicketsTable();
    if (activeTab === 'dashboard') {
        renderDashboard();
    }
}

// Window resize handling
window.addEventListener('resize', updateStickyOffsets);

// Boot
init();
