// table-tools.js — Tri, filtres et redimensionnement des colonnes
// (extrait de l'ancien app.js, chargement en scope global classique)

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
            sortedValues.map(v => `<option value="${escapeHtml(v)}" ${v.toLowerCase() === currentVal.toLowerCase() ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
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

// getCalculations migrée vers utils.js

