// render-tickets.js — Rendu de la table principale des tickets
// (extrait de l'ancien app.js, chargement en scope global classique)

// --- Render Main Table ---
function renderTicketsTable() {
    const project = Store.projects.find((p) => p.id === currentProjectId);
    if (!project) {
        console.warn('RENDER_TICKETS: Missing project for ID', currentProjectId);
        DOM.ticketsTbody.innerHTML =
            '<tr><td colspan="15" style="text-align:center; padding: 2rem; color: var(--text-muted);">Veuillez créer un projet pour commencer.</td></tr>';
        return;
    }

    debug(
        `RENDER_TICKETS: Filtering for version [${currentVersionId}]. Total tickets in Store: ${Store.tickets.length}`
    );
    if (Store.tickets.length > 0) {
        debug('DEBUG_TICKET_SAMPLE:', Store.tickets[0]);
    }

    let viewTickets = Store.tickets.filter((t) => {
        const match = String(t.versionId) === String(currentVersionId);
        return match;
    });

    debug(`RENDER_TICKETS: Filtered tickets: ${viewTickets.length}`);

    if (filterUserId) {
        viewTickets = viewTickets.filter(
            (t) => t.assignDesignId === filterUserId || t.assignExecutionId === filterUserId
        );
    }

    const filtered = filterData(viewTickets, 'tickets');
    updateFilterOptions('tickets', viewTickets); // Populate based on current version's tickets
    const sorted = sortData(filtered, 'tickets');

    // Calcul dynamique des largeurs basées sur le contenu possible
    const designOptions = ['À faire', 'En cours', 'Terminée'];
    const execOptions = [
        'À exécuter',
        'En attente livraison',
        'Bloquée',
        "En cours d'exécution",
        'Terminée OK',
        'Terminée KO'
    ];
    const wState = getRequiredWidth(project.ticketStates || []);
    const wDesign = getRequiredWidth(designOptions);
    const wExec = getRequiredWidth(execOptions);
    const wConso = getRequiredWidth(['Consommé']);
    const wJH = getRequiredWidth(['J/H (E)']); // Identique pour C et E
    const wRAF = getRequiredWidth(['RAF']);

    // Application dynamique sur les en-têtes (On force la largeur pour éviter le squeeze)
    const thState = document.querySelector('th[data-col="ticketState"]');
    if (thState) {
        thState.style.width = `${wState}px`;
        thState.style.minWidth = `${wState}px`;
    }
    const thDesign = document.querySelector('th[data-col="statusDesign"]');
    if (thDesign) {
        thDesign.style.width = `${wDesign}px`;
        thDesign.style.minWidth = `${wDesign}px`;
    }
    const thExec = document.querySelector('th[data-col="statusExecution"]');
    if (thExec) {
        thExec.style.width = `${wExec}px`;
        thExec.style.minWidth = `${wExec}px`;
    }
    const thConso = document.querySelector('th[data-col="consumed"]');
    if (thConso) {
        thConso.style.width = `${wConso}px`;
        thConso.style.minWidth = `${wConso}px`;
    }
    const thJHC = document.querySelector('th[data-col="jConception"]');
    if (thJHC) {
        thJHC.style.width = `${wJH}px`;
        thJHC.style.minWidth = `${wJH}px`;
    }
    const thJHE = document.querySelector('th[data-col="jExecution"]');
    if (thJHE) {
        thJHE.style.width = `${wJH}px`;
        thJHE.style.minWidth = `${wJH}px`;
    }
    const thRAF = document.querySelector('th[data-col="raf"]');
    if (thRAF) {
        thRAF.style.width = `${wRAF}px`;
        thRAF.style.minWidth = `${wRAF}px`;
    }

    DOM.ticketsTbody.innerHTML = sorted
        .map((t) => {
            const calcs = getCalculations(t, project);

            const execOptions = [
                'En attente livraison',
                'Bloquée',
                'À exécuter',
                "En cours d'exécution",
                'Terminée OK',
                'Terminée KO'
            ];
            const designOptions = ['À faire', 'En cours', 'Terminée'];

            const getStatusClass = (status) => {
                if (status.includes('OK') || status === 'Terminée') return 'done-ok';
                if (status.includes('KO')) return 'done-ko';
                if (status === 'Bloquée') return 'blocked';
                return '';
            };

            const tid = escapeHtml(t.id);
            return `
            <tr>
                <td class="sticky-left-1">
                    <div style="display: flex; gap: 0.2rem;">
                        <button class="btn" style="padding: 0.2rem; background: var(--accent-primary);" onclick="editTicket('${tid}')" title="Modifier">
                            <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn" style="padding: 0.2rem; background: var(--danger);" onclick="deleteTicket('${tid}')" title="Supprimer">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </td>
                <td class="sticky-left-2" style="font-weight:600; color:var(--text-muted);">#${escapeHtml(t.number)}</td>
                <td>${escapeHtml(t.feature)}</td>
                <td><span style="padding:2px 6px; border-radius:4px; background:rgba(255,255,255,0.1); font-size:11px">${escapeHtml(t.type)}</span></td>
                <td>${escapeHtml(t.priority)}</td>
                <td>${escapeHtml(getUserName(t.assignDesignId))}</td>
                <td>${escapeHtml(getUserName(t.assignExecutionId))}</td>
                <td>${escapeHtml(t.nbTestCases)}</td>
                <td style="min-width: ${wState}px">
                    <select class="status-select ${getStatusClass(t.ticketState || '')}" onchange="onTicketStateChange('${tid}', this.value)">
                        ${(project.ticketStates || []).map((o) => `<option value="${escapeHtml(o)}" ${t.ticketState === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
                    </select>
                </td>
                <td style="color:var(--accent-primary); font-weight:600">${calcs.jConception}</td>
                <td style="color:var(--accent-secondary); font-weight:600">${calcs.jExecution}</td>
                <td>
                    <input type="text" class="editable-field" value="${formatFrenchFloat(t.consumed)}" onchange="onConsommeChange('${tid}', this.value)">
                </td>
                <td style="font-weight:700">${calcs.raf}</td>
                <td style="width: ${wDesign}px; min-width: ${wDesign}px">
                    <select class="status-select ${getStatusClass(t.statusDesign || '')}" onchange="onDesignChange('${tid}', this.value)">
                        ${designOptions.map((o) => `<option value="${escapeHtml(o)}" ${t.statusDesign === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
                    </select>
                </td>
                <td style="width: ${wExec}px; min-width: ${wExec}px">
                    <select class="status-select ${getStatusClass(t.statusExecution || '')}" onchange="onExecChange('${tid}', this.value)">
                        ${execOptions.map((o) => `<option value="${escapeHtml(o)}" ${t.statusExecution === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
                    </select>
                </td>
                <td>
                    <input type="text" class="editable-field" style="text-align:left;" value="${escapeHtml(t.comment)}" onchange="onCommentChange('${tid}', this.value)">
                </td>
            </tr>
        `;
        })
        .join('');

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
    document.querySelectorAll('.data-table').forEach((table) => {
        const ref = table.querySelector('th.sticky-left-1');
        if (!ref) return;

        // Utilisation de getBoundingClientRect pour une précision au sous-pixel
        // On soustrait un infime montant (0.2px) pour garantir un recouvrement parfait
        // et boucher toute fuite visuelle.
        const rect = ref.getBoundingClientRect();
        const w = (rect.width - 0.2).toFixed(2);

        table.querySelectorAll('.sticky-left-2').forEach((el) => {
            el.style.left = w + 'px';
        });
    });
}

window.editTicket = (id) => {
    const t = Store.tickets.find((tick) => tick.id === id);
    if (t) {
        updateFormStates();
        DOM.ticketForm.reset();
        const mTitle = document.getElementById('modalTitle');
        if (mTitle) mTitle.textContent = 'Modifier le Ticket';

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
    if (confirm('Voulez-vous vraiment supprimer ce ticket ?')) {
        try {
            await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TICKETS, id);
            removeStoreDoc('tickets', id);
            updateUI();
            notify('Ticket supprimé.', 'success');
        } catch (error) {
            console.error('Error deleting ticket:', error);
            notify('Échec de la suppression du ticket.', 'error');
        }
    }
};
