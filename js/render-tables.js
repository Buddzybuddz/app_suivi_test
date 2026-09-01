// render-tables.js — Rendu des tables projets / versions / utilisateurs
// (extrait de l'ancien app.js, chargement en scope global classique)

// --- Render Projects Table ---
function renderProjectsTable() {
    if (!DOM.projectsTbody) return;
    updateFilterOptions('projects', Store.projects);
    const filtered = filterData(Store.projects, 'projects');
    const sorted = sortData(filtered, 'projects');
    DOM.projectsTbody.innerHTML = sorted
        .map(
            (p) => `
        <tr>
            <td>${escapeHtml(p.id)}</td>
            <td>${escapeHtml(p.client || '-')}</td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.designRatio)}</td>
            <td>${escapeHtml(p.executionRatio)}</td>
            <td>
                <button class="btn" style="padding: 0.4rem; background: var(--accent-primary);" onclick="editProject('${escapeHtml(p.id)}')" title="Modifier">
                    <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn" style="padding: 0.4rem; margin-left: 0.5rem; background: var(--danger);" onclick="deleteProject('${escapeHtml(p.id)}')" title="Supprimer">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </td>
        </tr>
    `
        )
        .join('');
    updateSortIndicators('projects');
    enableColumnResizing(DOM.projectsTbody.parentElement, 'projects');
    lucide.createIcons();
}

window.editProject = (id) => {
    const p = Store.projects.find((proj) => proj.id === id);
    if (p) {
        openProjectModal(p);
    }
};

window.deleteProject = async (id) => {
    if (!confirm('Supprimer ce projet et TOUTES ses données ?')) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PROJECTS, id);
        removeStoreDoc('projects', id);
        renderProjectsTable();

        if (currentProjectId === id) {
            currentProjectId = ''; // Invalider le projet courant
        }
        validateAndSaveState();
        populateHeaderSelects();
        updateUI();
        notify('Projet supprimé.', 'success');
    } catch (error) {
        console.error('Error deleting project:', error);
        notify('Échec de la suppression du projet.', 'error');
    }
};

// --- Render Versions Table ---
function renderVersionsTable() {
    if (!DOM.versionsTbody) return;
    updateFilterOptions('versions', Store.versions);
    const filtered = filterData(Store.versions, 'versions');
    const sorted = sortData(filtered, 'versions');
    DOM.versionsTbody.innerHTML = sorted
        .map((v) => {
            const proj = Store.projects.find((p) => p.id === v.projectId);
            const pName = proj ? proj.name : 'Inconnu';

            return `
            <tr>
                <td>${escapeHtml(v.id)}</td>
                <td><strong>${escapeHtml(v.name)}</strong></td>
                <td>${escapeHtml(pName)}</td>

                <td>${v.deliveryDateClient ? new Date(v.deliveryDateClient).toLocaleDateString('fr-FR') : '-'}</td>
                <td>${v.deliveryDateActual ? new Date(v.deliveryDateActual).toLocaleDateString('fr-FR') : '-'}</td>
                <td>
                    <button class="btn" style="padding: 0.4rem; background: var(--accent-primary);" onclick="editVersion('${escapeHtml(v.id)}')" title="Modifier">
                        <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                    </button>
                    <button class="btn" style="padding: 0.4rem; margin-left: 0.5rem; background: var(--danger);" onclick="deleteVersion('${escapeHtml(v.id)}')" title="Supprimer">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `;
        })
        .join('');
    updateSortIndicators('versions');
    enableColumnResizing(DOM.versionsTbody.parentElement, 'versions');
    lucide.createIcons();
}

window.editVersion = (id) => {
    const v = Store.versions.find((ver) => ver.id === id);
    if (v) {
        openVersionModal(v);
    }
};

window.deleteVersion = async (id) => {
    if (!confirm('Supprimer cette version ?')) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.VERSIONS, id);
        removeStoreDoc('versions', id);
        renderVersionsTable();

        if (currentVersionId === id) {
            currentVersionId = ''; // Invalider la version courante
        }
        validateAndSaveState();
        updateVersionSelect();
        updateUI();
        notify('Version supprimée.', 'success');
    } catch (error) {
        console.error('Error deleting version:', error);
        notify('Échec de la suppression de la version.', 'error');
    }
};

// --- Render Users Table ---
function renderUsersTable() {
    if (!DOM.usersTbody) return;
    updateFilterOptions('users', Store.users);
    const filtered = filterData(Store.users, 'users');
    const sorted = sortData(filtered, 'users');
    DOM.usersTbody.innerHTML = sorted
        .map(
            (u) => `
        <tr>
            <td>${escapeHtml(u.id)}</td>
            <td><strong>${escapeHtml(u.name)}</strong></td>
            <td><span class="badge ${u.role === 'Admin' ? 'badge-prio-haute' : 'badge-prio-basse'}">${escapeHtml(u.role)}</span></td>
            <td>
                <button class="btn" style="padding: 0.4rem; background: var(--accent-primary);" onclick="editUser('${escapeHtml(u.id)}')" title="Modifier">
                    <i data-lucide="edit-2" style="width: 16px; height: 16px;"></i>
                </button>
                <button class="btn" style="padding: 0.4rem; margin-left: 0.5rem; background: var(--danger);" onclick="deleteUser('${escapeHtml(u.id)}')" title="Supprimer">
                    <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
            </td>
        </tr>
    `
        )
        .join('');
    updateSortIndicators('users');
    enableColumnResizing(DOM.usersTbody.parentElement, 'users');
    lucide.createIcons();
}

window.editUser = (id) => {
    const u = Store.users.find((usr) => usr.id === id);
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
    if (!confirm('Supprimer cet utilisateur ?')) return;
    try {
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.USERS, id);
        removeStoreDoc('users', id);
        renderUsersTable();
        populateFormSelects();
        updateFormUsers();
        renderTicketsTable();
        notify('Utilisateur supprimé.', 'success');
    } catch (error) {
        console.error('Error deleting user:', error);
        notify("Échec de la suppression de l'utilisateur.", 'error');
    }
};
