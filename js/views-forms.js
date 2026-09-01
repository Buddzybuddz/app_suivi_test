// views-forms.js — Bascule de vue, selects d'en-tete, modales, helpers de dates
// (extrait de l'ancien app.js, chargement en scope global classique)

/**
 * Fonction centrale de basculement de vue
 */
function switchView(viewName) {
    if (!viewName) return;
    debug('SWITCH_VIEW: target =', viewName);

    // Refresh DOM pour être sûr d'avoir les éléments à jour
    refreshDOM();

    // 1. Sidebar highlight
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((n) => {
        if (n.getAttribute('data-view') === viewName) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
    });

    // 2. Sections display
    const sections = document.querySelectorAll('.view-section');
    sections.forEach((s) => {
        const idSuffix = s.id.replace('view-', '');
        if (idSuffix === viewName) {
            s.classList.add('active');
            s.style.setProperty('display', 'flex', 'important');
            s.style.setProperty('visibility', 'visible', 'important');
            s.style.setProperty('opacity', '1', 'important');

            // Log de diagnostic pour confirmer la présence à l'écran
            const rect = s.getBoundingClientRect();
            debug(
                `SECTION_STATS [${s.id}]: Visible: true, Rect: w=${rect.width}, h=${rect.height}, top=${rect.top}`
            );
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

    const clients = Array.from(new Set(Store.projects.map((p) => (p.client || '').trim())))
        .filter((c) => c !== '')
        .sort();

    debug('POPULATE_HEADER: Available clients:', clients);

    DOM.clientSelect.innerHTML =
        clients.length > 0
            ? clients
                  .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
                  .join('')
            : '<option value="">Sans Client</option>';
    DOM.clientSelect.value = currentClientName;

    const filteredProjects = Store.projects.filter(
        (p) => (p.client || '').trim() === currentClientName
    );
    debug(`POPULATE_HEADER: Projects for [${currentClientName}]:`, filteredProjects.length);

    DOM.projectSelect.innerHTML = filteredProjects
        .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
        .join('');
    DOM.projectSelect.value = currentProjectId;

    // Mise à jour de la liste dans le modal version
    if (DOM.vProject) {
        DOM.vProject.innerHTML = Store.projects
            .map((p) => {
                const displayName = p.client ? `${p.client} - ${p.name}` : p.name;
                return `<option value="${escapeHtml(p.id)}">${escapeHtml(displayName)}</option>`;
            })
            .join('');
    }

    updateVersionSelect();

    // Déclenchement automatique de la mise à jour UI pour peupler le tracker avec le premier projet s'il y en a un
    updateUI();
}

function updateVersionSelect() {
    if (!DOM.versionSelect) return;

    validateAndSaveState(); // Au cas où

    const versions = Store.versions.filter((v) => v.projectId === currentProjectId);
    debug(`UPDATE_VERSION: Versions for project [${currentProjectId}]:`, versions.length);

    DOM.versionSelect.innerHTML = versions
        .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`)
        .join('');
    DOM.versionSelect.value = currentVersionId;
}

function populateFormSelects() {
    // Only keeping for retro-compatibility if needed
}

let currentProjectUsers = [];
let currentProjectStates = [];

function populatePUserSelectToAdd() {
    if (!DOM.pUserSelectToAdd) return;
    const available = Store.users.filter((u) => !currentProjectUsers.includes(u.id));
    DOM.pUserSelectToAdd.innerHTML =
        `<option value="">-- Sélectionner un utilisateur --</option>` +
        available
            .map(
                (u) =>
                    `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} (${escapeHtml(u.role)})</option>`
            )
            .join('');
}

function renderProjectMembersBadge() {
    if (!DOM.projectMembersContainer) return;
    if (currentProjectUsers.length === 0) {
        DOM.projectMembersContainer.innerHTML = `<span class="members-placeholder">Aucun membre sélectionné.</span>`;
        return;
    }
    DOM.projectMembersContainer.innerHTML = currentProjectUsers
        .map((uid) => {
            const u = Store.users.find((usr) => usr.id === uid);
            const name = u ? u.name : 'Inconnu';
            return `
            <div class="member-badge">
                ${escapeHtml(name)}
                <i data-lucide="x" class="member-badge-remove" onclick="removeUserFromProjectUI('${escapeHtml(uid)}')"></i>
            </div>
        `;
        })
        .join('');
    lucide.createIcons();
    populatePUserSelectToAdd();
}

function renderProjectStatesBadge() {
    if (!DOM.projectStatesContainer) return;
    if (currentProjectStates.length === 0) {
        DOM.projectStatesContainer.innerHTML = `<span class="members-placeholder">Aucun état défini.</span>`;
        return;
    }
    DOM.projectStatesContainer.innerHTML = currentProjectStates
        .map(
            (state) => `
        <div class="member-badge">
            ${escapeHtml(state)}
            <i data-lucide="x" class="member-badge-remove" onclick="removeProjectStateUI('${escapeHtml(state)}')"></i>
        </div>
    `
        )
        .join('');
    lucide.createIcons();
}

window.removeUserFromProjectUI = (uid) => {
    currentProjectUsers = currentProjectUsers.filter((id) => id !== uid);
    renderProjectMembersBadge();
};

window.removeProjectStateUI = (state) => {
    currentProjectStates = currentProjectStates.filter((s) => s !== state);
    renderProjectStatesBadge();
};

function updateFormUsers() {
    const project = Store.projects.find((p) => p.id === currentProjectId);
    let allowedUsers = Store.users;
    if (project && project.userIds && project.userIds.length > 0) {
        allowedUsers = Store.users.filter((u) => project.userIds.includes(u.id));
    }

    const usersOptions =
        `<option value="">-- Aucun --</option>` +
        allowedUsers
            .map(
                (u) =>
                    `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} (${escapeHtml(u.role)})</option>`
            )
            .join('');
    DOM.fAssC.innerHTML = usersOptions;
    DOM.fAssE.innerHTML = usersOptions;

    DOM.filterUser.innerHTML =
        `<option value="">Tous les utilisateurs</option>` +
        allowedUsers
            .map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`)
            .join('');
}

// Project Modal Logic
const openProjectModal = (p = null) => {
    DOM.projectForm.reset();
    if (p) {
        DOM.projectModalTitle.textContent = 'Modifier le Projet';
        DOM.pId.value = p.id;
        DOM.pClient.value = p.client || '';
        DOM.pName.value = p.name;
        currentProjectStates = p.ticketStates ? [...p.ticketStates] : ['Nouveau'];
        DOM.pRatioC.value = p.designRatio;
        DOM.pRatioE.value = p.executionRatio;
        currentProjectUsers = p.userIds ? [...p.userIds] : [];
    } else {
        DOM.projectModalTitle.textContent = 'Nouveau Projet';
        DOM.pId.value = '';
        DOM.pClient.value = '';
        currentProjectStates = ['Nouveau', 'Validé', 'Rejeté', 'Fermé'];
        currentProjectUsers = [];
    }
    populatePUserSelectToAdd();
    renderProjectMembersBadge();
    renderProjectStatesBadge();
    DOM.projectModal.classList.add('show');
};

const MONTH_NAMES = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre'
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
    yEl.value = '';
    mEl.value = '';
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
    const clients = Array.from(new Set(Store.projects.map((p) => p.client || ''))).sort();
    DOM.vClient.innerHTML = clients
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c || 'Sans Client')}</option>`)
        .join('');

    const updateVProjectList = (clientName) => {
        const filtered = Store.projects.filter((p) => (p.client || '') === clientName);
        DOM.vProject.innerHTML = filtered
            .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
            .join('');
    };

    if (v) {
        const p = Store.projects.find((proj) => proj.id === v.projectId);
        const cName = p ? p.client || '' : '';

        DOM.versionModalTitle.textContent = 'Modifier la Version';
        DOM.vId.value = v.id;
        DOM.vClient.value = cName;
        updateVProjectList(cName);
        DOM.vProject.value = v.projectId;
        DOM.vClient.disabled = true;
        DOM.vProject.disabled = true;
        DOM.vName.value = v.name;
        setDateValues(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y, v.deliveryDateClient);
        setDateValues(
            DOM.vDateActual_D,
            DOM.vDateActual_M,
            DOM.vDateActual_Y,
            v.deliveryDateActual
        );
    } else {
        DOM.versionModalTitle.textContent = 'Nouvelle Version';
        DOM.vId.value = '';
        setDateValues(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y, null);
        setDateValues(DOM.vDateActual_D, DOM.vDateActual_M, DOM.vDateActual_Y, null);
        DOM.vClient.disabled = false;
        DOM.vProject.disabled = false;

        // Initialisation basée sur la sélection actuelle du header si possible
        const initClient = fromHeader ? currentClientName : clients[0] || '';
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
        DOM.uRole.value = u.role;
    } else {
        DOM.userModalTitle.textContent = 'Nouvel Utilisateur';
        DOM.uId.value = '';
        DOM.uRole.value = 'Testeur';
    }
    DOM.userModal.classList.add('show');
};

function updateFormStates() {
    const project = Store.projects.find((p) => p.id === currentProjectId);
    if (project) {
        DOM.fState.innerHTML = project.ticketStates
            .map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`)
            .join('');
    }
}

function updateFormVersions() {
    const versions = Store.versions.filter((v) => v.projectId === currentProjectId);
    DOM.fVersion.innerHTML = versions
        .map((v) => `<option value="${escapeHtml(v.id)}">${escapeHtml(v.name)}</option>`)
        .join('');
    DOM.fVersion.value = currentVersionId;
}

function updateFeatureDatalist() {
    if (!DOM.fFeatList) return;
    const features = new Set();
    Store.tickets.forEach((t) => {
        const v = Store.versions.find((ver) => ver.id === t.versionId);
        if (v && v.projectId === currentProjectId && t.feature) {
            features.add(t.feature);
        }
    });
    DOM.fFeatList.innerHTML = Array.from(features)
        .sort()
        .map((f) => `<option value="${escapeHtml(f)}">`)
        .join('');
}
