// events.js — setupEventListeners + mutations de tickets
// (extrait de l'ancien app.js, chargement en scope global classique)

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

    // Fermeture générique des modales : clic sur l'arrière-plan + touche Échap
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('mousedown', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(m => m.classList.remove('show'));
        }
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
                notify("Cet utilisateur est déjà attribué à ce projet.", 'warning');
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
                let res;
                if (pId) {
                    res = await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, pId, data);
                } else {
                    res = await databases.createDocument(DATABASE_ID, COLLECTIONS.PROJECTS, ID.unique(), data);
                    currentProjectId = res.$id;
                }

                upsertStoreDoc('projects', res); // MàJ locale ciblée (pas de rechargement complet)
                DOM.projectModal.classList.remove('show');
                renderProjectsTable();
                populateHeaderSelects();
                updateFormUsers();
                if (typeof renderVersionsTable === 'function') renderVersionsTable();
                updateUI();
                notify(pId ? 'Projet mis à jour.' : 'Projet créé.', 'success');
            } catch (error) {
                console.error("Error saving project:", error);
                notify("Échec de l'enregistrement du projet.", 'error');
            }
        });
    }



    // Listener pour le changement de client dans la modale version
    if (DOM.vClient) {
        DOM.vClient.addEventListener('change', (e) => {
            const clientName = e.target.value;
            const filtered = Store.projects.filter(p => (p.client || '') === clientName);
            DOM.vProject.innerHTML = filtered.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
        });
    }

    if (DOM.btnNewVersion) {
        DOM.btnNewVersion.addEventListener('click', () => {
            if (!currentProjectId) return notify("Sélectionnez d'abord un projet.", 'warning');
            openVersionModal(null, true);
        });
    }

    if (DOM.btnNewVersionPage) {
        DOM.btnNewVersionPage.addEventListener('click', () => {
            if (Store.projects.length === 0) return notify("Créez d'abord un projet.", 'warning');
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
                deliveryDateClient: getDateStringFromSelectors(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y),
                deliveryDateActual: getDateStringFromSelectors(DOM.vDateActual_D, DOM.vDateActual_M, DOM.vDateActual_Y)
            };

            try {
                let res;
                if (vId) {
                    res = await databases.updateDocument(DATABASE_ID, COLLECTIONS.VERSIONS, vId, data);
                } else {
                    res = await databases.createDocument(DATABASE_ID, COLLECTIONS.VERSIONS, ID.unique(), data);
                    currentVersionId = res.$id;
                }

                upsertStoreDoc('versions', res);
                DOM.versionModal.classList.remove('show');
                updateVersionSelect();
                if (DOM.versionSelect.querySelector(`option[value="${currentVersionId}"]`)) {
                    DOM.versionSelect.value = currentVersionId;
                }
                updateUI();
                renderVersionsTable();
                notify(vId ? 'Version mise à jour.' : 'Version créée.', 'success');
            } catch (error) {
                console.error("Error saving version:", error);
                notify("Échec de l'enregistrement de la version.", 'error');
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
                notify("Cet utilisateur existe déjà dans l'annuaire.", 'warning');
                return;
            }

            const data = {
                name: newName,
                role: DOM.uRole.value
            };

            try {
                let res;
                if (uid) {
                    res = await databases.updateDocument(DATABASE_ID, COLLECTIONS.USERS, uid, data);
                } else {
                    res = await databases.createDocument(DATABASE_ID, COLLECTIONS.USERS, ID.unique(), data);
                }

                upsertStoreDoc('users', res);
                DOM.userModal.classList.remove('show');
                renderUsersTable();
                populateFormSelects();
                updateFormUsers();
                renderTicketsTable();
                updateUI();
                notify(uid ? 'Utilisateur mis à jour.' : 'Utilisateur créé.', 'success');
            } catch (error) {
                console.error("Error saving user:", error);
                notify("Échec de l'enregistrement de l'utilisateur.", 'error');
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
                notify("Échec de la capture du rapport.", 'error');
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
                notify("Échec de la capture des graphiques.", 'error');
                DOM.btnCopyCharts.innerHTML = originalText;
            }
        });
    }

    // Initialize custom date selectors once
    setupDateSelectorGroup(DOM.vDate_D, DOM.vDate_M, DOM.vDate_Y);
    setupDateSelectorGroup(DOM.vDateActual_D, DOM.vDateActual_M, DOM.vDateActual_Y);

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
        if (!currentVersionId) return notify("Sélectionnez d'abord une version.", 'warning');
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

        const submitBtn = DOM.ticketForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i data-lucide="loader"></i> Enregistrement...';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        const tIdValue = DOM.tId ? DOM.tId.value : null;
        const nbTests = parseFloat(DOM.fTests.value) || 0;

        const targetVersionId = DOM.fVersion.value || currentVersionId;
        const newNumber = parseInt(DOM.fNum.value) || 0;

        // Validation d'unicité par version
        if (targetVersionId && newNumber > 0) {
            const isDuplicate = Store.tickets.some(t => {
                if (tIdValue && t.id === tIdValue) return false; // Ignorer le ticket web en cours d'édition
                return String(t.versionId) === String(targetVersionId) && Number(t.number) === Number(newNumber);
            });

            if (isDuplicate) {
                notify("Un ticket porte déjà ce numéro dans cette version.", 'warning');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="save" class="btn-icon-sm"></i> Enregistrer';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
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
            let res;
            if (tIdValue) {
                res = await databases.updateDocument(DATABASE_ID, COLLECTIONS.TICKETS, tIdValue, data);
            } else {
                res = await databases.createDocument(DATABASE_ID, COLLECTIONS.TICKETS, ID.unique(), data);
            }

            upsertStoreDoc('tickets', res);
            DOM.modal.classList.remove('show');
            updateUI();
            notify(tIdValue ? 'Ticket mis à jour.' : 'Ticket créé.', 'success');
        } catch (error) {
            console.error("Error saving ticket:", error);
            notify("Échec de l'enregistrement du ticket.", 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i data-lucide="save" class="btn-icon-sm"></i> Enregistrer';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
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

    // MàJ optimiste : on applique localement puis on confirme / on annule.
    const ticket = Store.tickets.find(t => t.id === id);
    const previous = ticket ? { ...ticket } : null;
    if (ticket) Object.assign(ticket, updates);
    updateUI();

    try {
        const res = await databases.updateDocument(DATABASE_ID, COLLECTIONS.TICKETS, id, updates);
        if (ticket) Object.assign(ticket, mapDoc(res));
        notify('Enregistré.', 'success', 1500);
    } catch (error) {
        console.error("Error updating ticket:", error);
        if (ticket && previous) Object.assign(ticket, previous); // rollback
        updateUI();
        notify("Échec de l'enregistrement — modification annulée.", 'error');
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
    const project = Store.projects.find(p => p.id === projectId) || Store.projects.find(p => p.id === currentProjectId);
    
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

