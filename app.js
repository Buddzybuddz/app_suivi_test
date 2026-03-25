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
    try {
        const [users, projects, versions, tickets] = await Promise.all([
            databases.listDocuments(DATABASE_ID, COLLECTIONS.USERS),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.VERSIONS),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS)
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
                    val = (item.nbTestCases / (Store.projects.find(p=>p.id===currentProjectId)?.designRatio || 1)).toFixed(2);
                } else if (col === 'jExecution') {
                    val = (item.nbTestCases / (Store.projects.find(p=>p.id===currentProjectId)?.executionRatio || 1)).toFixed(2);
                } else if (col === 'raf') {
                    const p = Store.projects.find(pr=>pr.id===currentProjectId);
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

        const sortedValues = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
        
        // Preserve "Tout" and reconstruction
        select.innerHTML = '<option value="">Tout</option>' + 
            sortedValues.map(v => `<option value="${v}" ${v.toLowerCase() === currentVal ? 'selected' : ''}>${v}</option>`).join('');
    });
}

function onFilterChange(table, col, val) {
    Store.filters[table][col] = val.toLowerCase();
    updateUI();
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
                    targetVal = (item.nbTestCases / (Store.projects.find(p=>p.id===currentProjectId)?.designRatio || 1)).toString();
                } else if (col === 'jExecution') {
                    targetVal = (item.nbTestCases / (Store.projects.find(p=>p.id===currentProjectId)?.executionRatio || 1)).toString();
                } else if (col === 'raf') {
                    const p = Store.projects.find(pr=>pr.id===currentProjectId);
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
            
            return targetVal.toLowerCase().includes(searchVal);
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
            const cmp = valA.localeCompare(valB, undefined, {numeric: true, sensitivity: 'base'});
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
    const rawRaf = Math.max(0, (jConception + jExecution) - (parseFloat(ticket.consumed) || 0));
    const raf = round015Up(rawRaf);
    return {
        jConception: jConception.toFixed(2),
        jExecution: jExecution.toFixed(2),
        raf: raf.toFixed(2)
    };
}

// --- DOM Elements ---
const DOM = {
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
    uiEmail: document.getElementById('uiEmail'),
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
    vProject: document.getElementById('vProject'),
    vName: document.getElementById('vName'),
    vDate: document.getElementById('vDate'),

    projectSelect: document.getElementById('projectSelect'),
    versionSelect: document.getElementById('versionSelect'),
    tabs: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    ticketsTbody: document.getElementById('ticketsTbody'),
    filterUser: document.getElementById('filterUser'),
    btnNewTicket: document.getElementById('btnNewTicket'),
    btnCopyDashboard: document.getElementById('btnCopyDashboard'),
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
    fFeat: document.getElementById('fFeat'), fType: document.getElementById('fType'),
    fNum: document.getElementById('fNum'), fPrio: document.getElementById('fPrio'),
    fAssC: document.getElementById('fAssC'), fAssE: document.getElementById('fAssE'),
    fTests: document.getElementById('fTests'), fState: document.getElementById('fState'),
    tId: document.getElementById('tId')
};

// --- Initialization ---
async function init() {
    await loadStore();

    if (Store.projects.length > 0) {
        currentProjectId = Store.projects[0].id;
        const versions = Store.versions.filter(v => v.projectId === currentProjectId);
        if (versions.length > 0) currentVersionId = versions[0].id;
    } else {
        currentProjectId = '';
        currentVersionId = '';
    }

    populateHeaderSelects();
    populateFormSelects();
    updateFormUsers();
    setupEventListeners();
    updateUI();
}

function populateHeaderSelects() {
    DOM.projectSelect.innerHTML = Store.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    DOM.projectSelect.value = currentProjectId;

    if(DOM.vProject) {
        DOM.vProject.innerHTML = Store.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    
    updateVersionSelect();
}

function updateVersionSelect() {
    const versions = Store.versions.filter(v => v.projectId === currentProjectId);
    DOM.versionSelect.innerHTML = versions.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    if(versions.length > 0) currentVersionId = versions[0].id;
    DOM.versionSelect.value = currentVersionId;
}

function populateFormSelects() {
    // Only keeping for retro-compatibility if needed
}

let currentProjectUsers = [];
let currentProjectStates = [];

function populatePUserSelectToAdd() {
    if(!DOM.pUserSelectToAdd) return;
    const available = Store.users.filter(u => !currentProjectUsers.includes(u.id));
    DOM.pUserSelectToAdd.innerHTML = `<option value="">-- Sélectionner un utilisateur --</option>` + 
        available.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
}

function renderProjectMembersBadge() {
    if(!DOM.projectMembersContainer) return;
    if(currentProjectUsers.length === 0) {
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

function updateFormStates() {
    const project = Store.projects.find(p => p.id === currentProjectId);
    if(project) {
        DOM.fState.innerHTML = project.ticketStates.map(s => `<option value="${s}">${s}</option>`).join('');
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    // Sidebar Navigation
    DOM.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.dataset.view;
            if (!targetView) return; // ignore items without data-view

            DOM.navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            DOM.viewSections.forEach(v => {
                if(v.id === 'view-' + targetView) {
                    v.classList.add('active');
                } else {
                    v.classList.remove('active');
                }
            });
            
            if(targetView === 'projects') renderProjectsTable();
            if(targetView === 'versions') renderVersionsTable();
            if(targetView === 'users') renderUsersTable();
        });
    });

    // Project Modal Logic
    const openProjectModal = (p = null) => {
        DOM.projectForm.reset();
        if (p) {
            DOM.projectModalTitle.textContent = "Modifier le Projet";
            DOM.pId.value = p.id;
            DOM.pName.value = p.name;
            currentProjectStates = p.ticketStates ? [...p.ticketStates] : ['Nouveau'];
            DOM.pRatioC.value = p.designRatio;
            DOM.pRatioE.value = p.executionRatio;
            currentProjectUsers = p.userIds ? [...p.userIds] : [];
        } else {
            DOM.projectModalTitle.textContent = "Nouveau Projet";
            DOM.pId.value = '';
            currentProjectStates = ['Nouveau', 'Validé', 'Rejeté', 'Fermé'];
            currentProjectUsers = [];
        }
        renderProjectMembersBadge();
        renderProjectStatesBadge();
        DOM.projectModal.classList.add('show');
    };

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
            if(uid && !currentProjectUsers.includes(uid)) {
                currentProjectUsers.push(uid);
                renderProjectMembersBadge();
            }
        });
        
        DOM.btnCreateAndAddUser.addEventListener('click', async () => {
            const name = DOM.pNewUserName.value.trim();
            if(name) {
                const data = {
                    name: name,
                    role: 'Testeur'
                };
                try {
                    await databases.createDocument(DATABASE_ID, COLLECTIONS.USERS, ID.unique(), data);
                    await loadStore();
                    const newUser = Store.users.find(u => u.name === name);
                    if (newUser) currentProjectUsers.push(newUser.id);
                    DOM.pNewUserName.value = '';
                    renderProjectMembersBadge();
                    if (typeof renderUsersTable === 'function') renderUsersTable();
                    updateFormUsers();
                } catch (error) {
                    console.error("Error creating user from project modal:", error);
                }
            }
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

    // Version Modal Logic
    const openVersionModal = (v = null, fromHeader = false) => {
        DOM.versionForm.reset();
        if (v) {
            DOM.versionModalTitle.textContent = "Modifier la Version";
            DOM.vId.value = v.id;
            DOM.vProject.value = v.projectId;
            DOM.vProject.disabled = true;
            DOM.vName.value = v.name;
            DOM.vDate.value = v.deliveryDate || '';
        } else {
            DOM.versionModalTitle.textContent = "Nouvelle Version";
            DOM.vId.value = '';
            DOM.vProject.disabled = fromHeader;
            if(fromHeader && currentProjectId) {
                DOM.vProject.value = currentProjectId;
            } else if (!fromHeader && Store.projects.length > 0) {
                DOM.vProject.value = Store.projects[0].id;
            }
        }
        DOM.versionModal.classList.add('show');
    };

    if (DOM.btnNewVersion) {
        DOM.btnNewVersion.addEventListener('click', () => {
            if(!currentProjectId) return alert("Veuillez d'abord sélectionner un projet.");
            openVersionModal(null, true);
        });
    }

    if (DOM.btnNewVersionPage) {
        DOM.btnNewVersionPage.addEventListener('click', () => {
            if(Store.projects.length === 0) return alert("Veuillez d'abord créer un projet.");
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
                deliveryDate: DOM.vDate.value || null
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
                if(DOM.versionSelect.querySelector(`option[value="${currentVersionId}"]`)) {
                    DOM.versionSelect.value = currentVersionId;
                }
                updateUI();
                if(activeTab === 'versions') renderVersionsTable();
                renderVersionsTable(); 
            } catch (error) {
                console.error("Error saving version:", error);
                alert("Erreur lors de l'enregistrement de la version.");
            }
        });
    }

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
            const data = {
                name: DOM.uiName.value,
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
            DOM.btnCopyDashboard.innerHTML = '<i data-lucide="loader"></i> Capture...';
            lucide.createIcons();

            try {
                const dashboard = document.getElementById('tab-dashboard');
                
                // Temporarily disable restricted height/overflow to capture full content
                const originalHeight = dashboard.style.height;
                const originalOverflow = dashboard.style.overflow;
                dashboard.style.height = 'auto';
                dashboard.style.overflow = 'visible';

                const canvas = await html2canvas(dashboard, {
                    backgroundColor: '#f1f5f9',
                    scale: 2,
                    logging: false,
                    useCORS: true,
                    scrollY: -window.scrollY
                });

                // Restore
                dashboard.style.height = originalHeight;
                dashboard.style.overflow = originalOverflow;

                canvas.toBlob(async (blob) => {
                    if (!blob) throw new Error("Erreur lors de la création de l'image.");
                    const item = new ClipboardItem({ "image/png": blob });
                    await navigator.clipboard.write([item]);
                    
                    DOM.btnCopyDashboard.innerHTML = '<i data-lucide="check"></i> Copié !';
                    DOM.btnCopyDashboard.style.background = 'var(--success)';
                    lucide.createIcons();
                    
                    setTimeout(() => {
                        DOM.btnCopyDashboard.innerHTML = originalText;
                        DOM.btnCopyDashboard.style.background = 'var(--accent-secondary)';
                        lucide.createIcons();
                    }, 2000);
                });
            } catch (err) {
                console.error(err);
                alert("Impossible de copier l'image. Assurez-vous d'être sur un navigateur moderne et sécurisé (HTTPS).");
                DOM.btnCopyDashboard.innerHTML = originalText;
                lucide.createIcons();
            }
        });
    }

    DOM.projectSelect.addEventListener('change', (e) => {
        currentProjectId = e.target.value;
        updateVersionSelect();
        updateFormUsers();
        updateUI();
    });
    
    DOM.versionSelect.addEventListener('change', (e) => {
        currentVersionId = e.target.value;
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
        if(!currentVersionId) return alert("Veuillez sélectionner une version d'abord.");
        updateFormStates();
        DOM.ticketForm.reset();
        if(DOM.tId) DOM.tId.value = '';
        const mTitle = document.getElementById('modalTitle');
        if(mTitle) mTitle.textContent = "Nouveau Ticket";
        DOM.modal.classList.add('show');
    });

    DOM.btnCloseModal.addEventListener('click', () => {
        DOM.modal.classList.remove('show');
    });

    DOM.ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tIdValue = DOM.tId ? DOM.tId.value : null;
        const nbTests = parseFloat(DOM.fTests.value) || 0;
        
        const data = {
            versionId: currentVersionId,
            feature: DOM.fFeat.value,
            type: DOM.fType.value,
            number: parseInt(DOM.fNum.value) || 0,
            priority: DOM.fPrio.value,
            assignDesignId: DOM.fAssC.value || null,
            assignExecutionId: DOM.fAssE.value || null,
            nbTestCases: nbTests,
            ticketState: DOM.fState.value,
            consumed: tIdValue ? (Store.tickets.find(t=>t.id===tIdValue)?.consumed || 0) : 0,
            statusDesign: tIdValue ? (Store.tickets.find(t=>t.id===tIdValue)?.statusDesign || 'À faire') : 'À faire',
            statusExecution: tIdValue ? (Store.tickets.find(t=>t.id===tIdValue)?.statusExecution || 'À exécuter') : 'À exécuter',
            comment: tIdValue ? (Store.tickets.find(t=>t.id===tIdValue)?.comment || '') : ''
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

async function updateTicket(id, field, value) {
    try {
        await databases.updateDocument(DATABASE_ID, COLLECTIONS.TICKETS, id, { [field]: value });
        const ticket = Store.tickets.find(t => t.id === id);
        if (ticket) ticket[field] = value;
        updateUI(); 
    } catch (error) {
        console.error("Error updating ticket field:", error);
    }
}

window.onConsommeChange = (id, val) => updateTicket(id, 'consumed', parseFloat(val) || 0);
window.onDesignChange = (id, val) => updateTicket(id, 'statusDesign', val);
window.onExecChange = (id, val) => updateTicket(id, 'statusExecution', val);
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
    if(p) {
        DOM.projectForm.reset();
        DOM.projectModalTitle.textContent = "Modifier le Projet";
        DOM.pId.value = p.id;
        DOM.pName.value = p.name;
        DOM.pRatioC.value = p.designRatio;
        DOM.pRatioE.value = p.executionRatio;
        DOM.projectModal.classList.add('show');
    }
};

window.deleteProject = async (id) => {
    if(!confirm("Supprimer ce projet et TOUTES ses données ?")) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PROJECTS, id);
        await loadStore();
        renderProjectsTable();
        populateHeaderSelects();
        
        if(currentProjectId === id) {
            currentProjectId = Store.projects[0]?.id || '';
            updateVersionSelect();
            updateUI();
        }
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
                <td>${v.deliveryDate ? new Date(v.deliveryDate).toLocaleDateString('fr-FR') : '-'}</td>
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
    if(v) {
        DOM.versionForm.reset();
        DOM.versionModalTitle.textContent = "Modifier la Version";
        DOM.vId.value = v.id;
        DOM.vProject.value = v.projectId;
        DOM.vProject.disabled = true; 
        DOM.vName.value = v.name;
        DOM.vDate.value = v.deliveryDate || '';
        DOM.versionModal.classList.add('show');
    }
};

window.deleteVersion = async (id) => {
    if(!confirm("Supprimer cette version ?")) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.VERSIONS, id);
        await loadStore();
        renderVersionsTable();
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
            <td>${u.email}</td>
            <td>${u.role}</td>
            <td>
                <button class="btn" style="padding: 0.2rem; background: var(--accent-primary);" onclick="editUser('${u.id}')" title="Modifier">
                    <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                </button>
                <button class="btn" style="padding: 0.2rem; margin-left: 0.5rem; background: var(--danger);" onclick="deleteUser('${u.id}')" title="Supprimer">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
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
    if(u) {
        DOM.userForm.reset();
        DOM.userModalTitle.textContent = "Modifier l'Utilisateur";
        DOM.uId.value = u.id;
        DOM.uiName.value = u.name;
        DOM.uiEmail.value = u.email;
        DOM.uRole.value = u.role;
        DOM.userModal.classList.add('show');
    }
};

window.deleteUser = async (id) => {
    if(!confirm("Supprimer cet utilisateur ?")) return;
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
        DOM.ticketsTbody.innerHTML = '<tr><td colspan="15" style="text-align:center; padding: 2rem; color: var(--text-muted);">Veuillez créer un projet pour commencer.</td></tr>';
        return;
    }
    let viewTickets = Store.tickets.filter(t => t.versionId === currentVersionId);
    
    if (filterUserId) {
        viewTickets = viewTickets.filter(t => t.assignDesignId === filterUserId || t.assignExecutionId === filterUserId);
    }
    
    const filtered = filterData(viewTickets, 'tickets');
    updateFilterOptions('tickets', viewTickets); // Populate based on current version's tickets
    const sorted = sortData(filtered, 'tickets');

    DOM.ticketsTbody.innerHTML = sorted.map(t => {
        const calcs = getCalculations(t, project);
        
        const execOptions = ['En attente livraison', 'Bloquée', 'À exécuter', 'En cours d\'exécution', 'Terminée OK', 'Terminée KO'];
        const designOptions = ['À faire', 'En cours', 'Terminée'];

        const getStatusClass = (status) => {
            if(status.includes('OK') || status === 'Terminée') return 'done-ok';
            if(status.includes('KO')) return 'done-ko';
            if(status === 'Bloquée') return 'blocked';
            return '';
        };

        return `
            <tr>
                <td>${t.feature}</td>
                <td><span style="padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.1); font-size:11px">${t.type}</span></td>
                <td>#${t.number}</td>
                <td>${t.priority}</td>
                <td>${getUserName(t.assignDesignId)}</td>
                <td>${getUserName(t.assignExecutionId)}</td>
                <td>${t.nbTestCases}</td>
                <td>
                    <select class="status-select" style="border-color: transparent;" onchange="onTicketStateChange('${t.id}', this.value)">
                        ${(project.ticketStates || []).map(o => `<option value="${o}" ${t.ticketState===o?'selected':''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td style="color:var(--accent-primary); font-weight:600">${calcs.jConception}</td>
                <td style="color:var(--accent-secondary); font-weight:600">${calcs.jExecution}</td>
                <td>
                    <input type="number" step="0.5" class="editable-field" value="${t.consumed}" onchange="onConsommeChange('${t.id}', this.value)">
                </td>
                <td style="font-weight:700">${calcs.raf}</td>
                <td>
                    <select class="status-select ${getStatusClass(t.statusDesign)}" onchange="onDesignChange('${t.id}', this.value)">
                        ${designOptions.map(o => `<option value="${o}" ${t.statusDesign===o?'selected':''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <select class="status-select ${getStatusClass(t.statusExecution)}" onchange="onExecChange('${t.id}', this.value)">
                        ${execOptions.map(o => `<option value="${o}" ${t.statusExecution===o?'selected':''}>${o}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="editable-field" style="text-align:left;" value="${t.comment}" onchange="onCommentChange('${t.id}', this.value)">
                </td>
                <td>
                    <button class="btn" style="padding: 0.2rem; background: var(--accent-primary);" onclick="editTicket('${t.id}')" title="Modifier">
                        <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button class="btn" style="padding: 0.2rem; background: var(--danger); margin-left: 0.2rem;" onclick="deleteTicket('${t.id}')" title="Supprimer">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    lucide.createIcons();
    updateSortIndicators('tickets');
    enableColumnResizing(DOM.ticketsTbody.parentElement, 'tickets');
}

window.editTicket = (id) => {
    const t = Store.tickets.find(tick => tick.id === id);
    if(t) {
        updateFormStates();
        DOM.ticketForm.reset();
        const mTitle = document.getElementById('modalTitle');
        if(mTitle) mTitle.textContent = "Modifier le Ticket";
        
        DOM.tId.value = t.id;
        DOM.fFeat.value = t.feature;
        DOM.fType.value = t.type;
        DOM.fNum.value = t.number;
        DOM.fPrio.value = t.priority;
        DOM.fAssC.value = t.assignDesignId || '';
        DOM.fAssE.value = t.assignExecutionId || '';
        DOM.fTests.value = t.nbTestCases;
        DOM.fState.value = t.ticketState;
        
        DOM.modal.classList.add('show');
    }
};

window.deleteTicket = async (id) => {
    if(confirm("Voulez-vous vraiment supprimer ce ticket ?")) {
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TICKETS, id);
            await loadStore();
            updateUI();
        } catch (error) {
            console.error("Error deleting ticket:", error);
        }
    }
};

// --- Render Dashboard ---
function renderDashboard() {
    const project = Store.projects.find(p => p.id === currentProjectId);
    if (!project) return;
    
    // Update dashboard header info
    if (DOM.dashProjectName) DOM.dashProjectName.textContent = project.name;
    const currentVersion = Store.versions.find(v => v.id === currentVersionId);
    if (DOM.dashVersionName) DOM.dashVersionName.textContent = currentVersion ? `Version : ${currentVersion.name}` : '-';

    const viewTickets = Store.tickets.filter(t => t.versionId === currentVersionId);
    
    let totalRaf = 0;
    let totalJConception = 0;
    let doneJConception = 0;
    let totalJExecution = 0;
    let doneJExecution = 0;

    const typeCount = {};
    const featureCount = {};
    const statusCount = {};
    const userRaf = {};

    viewTickets.forEach(t => {
        const calcs = getCalculations(t, project);
        const tRaf = parseFloat(calcs.raf);
        totalRaf += tRaf;

        const jC = parseFloat(calcs.jConception);
        const jE = parseFloat(calcs.jExecution);
        
        totalJConception += jC;
        totalJExecution += jE;
        
        if (t.statusDesign === 'Terminée') {
            doneJConception += jC;
        }
        if (t.statusExecution === 'Terminée OK' || t.statusExecution === 'Terminée KO') {
            doneJExecution += jE;
        }

        if(!typeCount[t.type]) typeCount[t.type] = { success: 0, fail: 0, pending: 0 };
        if(t.statusExecution === 'Terminée OK') typeCount[t.type].success++;
        else if(t.statusExecution === 'Terminée KO') typeCount[t.type].fail++;
        else typeCount[t.type].pending++;

        statusCount[t.statusExecution] = (statusCount[t.statusExecution] || 0) + 1;

        if(!featureCount[t.feature]) featureCount[t.feature] = { success: 0, fail: 0, pending: 0 };
        if(t.statusExecution === 'Terminée OK') featureCount[t.feature].success++;
        else if(t.statusExecution === 'Terminée KO') featureCount[t.feature].fail++;
        else featureCount[t.feature].pending++;

        const consumedC = (t.consumed * (jC/(jC+jE+0.001)));
        const consumedE = (t.consumed * (jE/(jC+jE+0.001)));
        const rafC = Math.max(0, jC - consumedC);
        const rafE = Math.max(0, jE - consumedE);

        if(t.assignDesignId) {
            if(!userRaf[t.assignDesignId]) userRaf[t.assignDesignId] = 0;
            userRaf[t.assignDesignId] += rafC;
        }
        if(t.assignExecutionId) {
            if(!userRaf[t.assignExecutionId]) userRaf[t.assignExecutionId] = 0;
            userRaf[t.assignExecutionId] += rafE;
        }
    });

    const advC = totalJConception > 0 ? (doneJConception / totalJConception * 100) : 0;
    const advE = totalJExecution > 0 ? (doneJExecution / totalJExecution * 100) : 0;
    const advTotal = (totalJConception + totalJExecution) > 0 ? ((doneJConception + doneJExecution) / (totalJConception + totalJExecution) * 100) : 0;

    // Update KPI values
    DOM.kpiTotalRaf.textContent = totalRaf.toFixed(2);
    DOM.kpiTotalTickets.textContent = viewTickets.length;
    DOM.kpiAdvC.textContent = advC.toFixed(0) + '%';
    DOM.kpiAdvE.textContent = advE.toFixed(0) + '%';
    DOM.kpiAdvTotal.textContent = advTotal.toFixed(0) + '%';

    // Update progress bars
    const barC = document.getElementById('kpiAdvCBar');
    const barE = document.getElementById('kpiAdvEBar');
    const barTotal = document.getElementById('kpiAdvTotalBar');
    if (barC) barC.style.width = advC.toFixed(0) + '%';
    if (barE) barE.style.width = advE.toFixed(0) + '%';
    if (barTotal) barTotal.style.width = advTotal.toFixed(0) + '%';

    // Workload data for chart
    const workloadPairs = Object.entries(userRaf).map(([uId, raf]) => ({ name: getUserName(uId), raf: round015Up(raf) }));
    workloadPairs.sort((a,b) => b.raf - a.raf);

    renderCharts(typeCount, featureCount, statusCount, workloadPairs, { advC, advE, totalJConception, totalJExecution, doneJConception, doneJExecution }, viewTickets.length);
}

function renderCharts(typeCount, featureCount, statusCount, workloadPairs, progressData, totalTickets) {
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
        if(chartInstances[id]) { chartInstances[id].destroy(); }
        const canvasEl = document.getElementById(id);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        Chart.defaults.color = textCol;
        Chart.defaults.font.family = 'Inter';
        chartInstances[id] = new Chart(ctx, { type, data, options });
    };

    // ==== Chart 1: Status by Type (stacked bar) ====
    const typeLabels = Object.keys(typeCount);
    applyChartConf('chartType', 'bar', {
        labels: typeLabels,
        datasets: [
            { 
                label: 'En attente / En cours', 
                data: typeLabels.map(l => typeCount[l].pending), 
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#fbbf24', '#f59e0b'); } catch(e) { return '#f59e0b'; }
                },
                borderRadius: 8,
                borderSkipped: false
            },
            { 
                label: 'Succès', 
                data: typeLabels.map(l => typeCount[l].success), 
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#34d399', '#10b981'); } catch(e) { return '#10b981'; }
                },
                borderRadius: 8,
                borderSkipped: false
            },
            { 
                label: 'Échec', 
                data: typeLabels.map(l => typeCount[l].fail), 
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#f87171', '#ef4444'); } catch(e) { return '#ef4444'; }
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

    // ==== Chart 2: Status by Feature (stacked bar) ====
    const featLabels = Object.keys(featureCount);
    applyChartConf('chartFeature', 'bar', {
        labels: featLabels,
        datasets: [
            { 
                label: 'En attente / En cours', 
                data: featLabels.map(l => featureCount[l].pending), 
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#818cf8', '#6366f1'); } catch(e) { return '#6366f1'; }
                },
                borderRadius: 8,
                borderSkipped: false
            },
            { 
                label: 'Succès', 
                data: featLabels.map(l => featureCount[l].success), 
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#34d399', '#10b981'); } catch(e) { return '#10b981'; }
                },
                borderRadius: 8,
                borderSkipped: false
            },
            { 
                label: 'Échec', 
                data: featLabels.map(l => featureCount[l].fail), 
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#f87171', '#ef4444'); } catch(e) { return '#ef4444'; }
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

    // ==== Chart 3: Progress Conception vs Exécution (grouped bar) ====
    applyChartConf('chartProgress', 'bar', {
        labels: ['Conception', 'Exécution'],
        datasets: [
            {
                label: 'Réalisé (J/h)',
                data: [progressData.doneJConception, progressData.doneJExecution],
                backgroundColor: (ctx) => {
                    try { return createGradient(ctx, '#34d399', '#10b981'); } catch(e) { return '#10b981'; }
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
                    try { return createGradient(ctx, '#cbd5e1', '#94a3b8'); } catch(e) { return '#94a3b8'; }
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

    // ==== Chart 5: Workload horizontal bar ====
    const workloadLabels = workloadPairs.map(w => w.name);
    const workloadData = workloadPairs.map(w => w.raf);

    applyChartConf('chartWorkload', 'bar', {
        labels: workloadLabels,
        datasets: [{
            label: 'RAF (J/h)',
            data: workloadData,
            backgroundColor: (ctx) => {
                try { return createGradient(ctx, '#6366f1', '#0ea5e9', true); } catch(e) { return '#6366f1'; }
            },
            borderRadius: 8,
            borderSkipped: false,
            barThickness: 28
        }]
    }, { 
        indexAxis: 'y',
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
            tooltip: modernTooltip,
            legend: { display: false }
        },
        scales: {
            x: { 
                grid: { color: gridCol, drawBorder: false, borderDash: [3, 3] },
                ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#64748b' }
            },
            y: { 
                grid: { display: false },
                ticks: { font: { family: 'Inter', size: 12, weight: '600' }, color: '#1e293b' }
            }
        }
    });
}

function updateUI() {
    renderTicketsTable();
    if(activeTab === 'dashboard') {
        renderDashboard();
    }
}

// Boot
init();
