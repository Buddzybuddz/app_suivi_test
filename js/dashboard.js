// dashboard.js — Tableau de bord, graphiques et updateUI
// (extrait de l'ancien app.js, chargement en scope global classique)

// --- Render Dashboard ---
function renderDashboard() {
    const project = Store.projects.find((p) => p.id === currentProjectId);
    if (!project) return;

    // Update dashboard header info
    if (DOM.dashProjectName) {
        const clientPrefix = project.client ? `${project.client} - ` : '';
        DOM.dashProjectName.textContent = `${clientPrefix}${project.name}`;
    }
    const currentVersion = Store.versions.find((v) => v.id === currentVersionId);
    if (DOM.dashVersionName)
        DOM.dashVersionName.textContent = currentVersion ? currentVersion.name : '-';

    const viewTickets = Store.tickets.filter((t) => t.versionId === currentVersionId);

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

    viewTickets.forEach((t) => {
        const calcs = getCalculations(t, project);
        // Somme brute : l'arrondi 0.15 fait par ticket ne doit pas se cumuler
        // (sinon le RAF global et la prévision de livraison sont gonflés).
        // Conséquence : RAF Global == RAF Conception + RAF Exécution.
        rafC_total += calcs.rafC;
        rafE_total += calcs.rafE;
        totalRaf += calcs.rafC + calcs.rafE;

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
        const typeNormalized = (t.type || '').toUpperCase();
        if (typeNormalized.includes('US')) nbUS++;
        else if (typeNormalized.includes('BUG')) nbBugs++;
        else if (typeNormalized.includes('TÂCHE') || typeNormalized.includes('TACHE')) nbTasks++;

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
        if (typeNormalized.includes('US')) featureStats[f].us++;
        else if (typeNormalized.includes('BUG')) featureStats[f].bug++;
        else featureStats[f].task++;
    });

    const statusObj = {
        execByType,
        designByType,
        execByFeat,
        designByFeat,
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
        const featEntries = Object.entries(featureStats).sort((a, b) => b[1].total - a[1].total);
        breakdownEl.innerHTML = featEntries
            .map(
                ([name, s]) => `
            <div class="kpi-card" style="padding: 1rem; flex-direction: column; align-items: flex-start; gap: 0.75rem; border: 1px solid rgba(0,0,0,0.03); background: rgba(255,255,255,0.4);">
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center; gap: 0.5rem;">
                    <h3 style="margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${escapeHtml(name)}">
                        ${escapeHtml(name)}
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
        `
            )
            .join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // --- Delivery Risk Logic ---
    const riskIcon = document.getElementById('dashRiskIcon');
    const riskText = document.getElementById('dashRiskText');
    const riskTitle = document.getElementById('dashRiskTitle');

    if (riskIcon && riskText && currentVersion) {
        const now = new Date();
        const fmt = (d) =>
            d
                ? d.toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                  })
                : 'Non définie';

        const parseDate = (dStr) => {
            if (!dStr) return null;
            const d = new Date(dStr);
            d.setHours(17, 0, 0, 0);
            return isNaN(d.getTime()) ? null : d;
        };

        const dClient = parseDate(currentVersion.deliveryDateClient);
        const dActual = parseDate(currentVersion.deliveryDateActual);

        const nbMembers = project.userIds ? Math.max(1, project.userIds.length) : 1;
        const daysNeededTotal = totalRaf / nbMembers;
        const daysNeededExecution = rafE_total / nbMembers;
        const finishDate = addWorkingDays(now, daysNeededTotal);

        const setSlot = (
            slotId,
            valId,
            value,
            show = true,
            color = null,
            labelId = null,
            labelText = null
        ) => {
            const s = document.getElementById(slotId);
            const v = document.getElementById(valId);
            const l = labelId ? document.getElementById(labelId) : null;
            if (s) {
                s.style.display = show ? 'flex' : 'none';
                if (color) s.style.background = color.bg;
            }
            if (v) {
                if (value) v.textContent = value;
                if (color) v.style.color = color.text;
            }
            if (l && labelText) l.textContent = labelText;
        };

        let dMaxRecette = null;
        let maxRecetteStr = '—';
        if (dClient) {
            const executionWithMargin = daysNeededExecution * 1.3;
            dMaxRecette = addWorkingDays(dClient, -executionWithMargin);
            maxRecetteStr = fmt(dMaxRecette);
        }

        setSlot('slotClientDate', 'valClientDate', fmt(dClient), !!dClient);

        if (dActual) {
            setSlot('slotActualDate', 'valActualDate', fmt(dActual), true);
            setSlot('slotMaxRecetteDate', 'valMaxRecetteDate', '', false);
            setSlot('slotPossibleDate', 'valPossibleDate', '', false);

            if (dClient) {
                const finalMargin = getWorkingDaysPrecise(dActual, dClient);
                const isDelayActual = finalMargin < 0;
                const marginAbsActual = round05Up(Math.abs(finalMargin));

                if (isDelayActual) {
                    const color = { bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444' };
                    setSlot(
                        'slotMargin',
                        'valMargin',
                        `${marginAbsActual.toFixed(1)} j`,
                        true,
                        color,
                        'labelMargin',
                        'Retard'
                    );
                } else {
                    setSlot('slotMargin', 'valMargin', '', false);
                }

                if (riskTitle) riskTitle.textContent = '';
                if (riskText) {
                    riskText.textContent = isDelayActual
                        ? `Livrée avec un retard de ${marginAbsActual.toFixed(1)} ${marginAbsActual <= 1 ? 'jour' : 'jours'}`
                        : 'Version livrée à temps';
                    riskText.style.color = isDelayActual ? '#ef4444' : '#10b981';
                }
                if (riskIcon) {
                    riskIcon.innerHTML = isDelayActual
                        ? '<i data-lucide="alert-triangle"></i>'
                        : '<i data-lucide="check-circle"></i>';
                    riskIcon.style.background = isDelayActual
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(16, 185, 129, 0.1)';
                    riskIcon.style.color = isDelayActual ? '#ef4444' : '#10b981';
                }
            } else {
                setSlot('slotMargin', 'valMargin', '', false);
                if (riskText) riskText.textContent = '';
            }
        } else {
            const margin = dClient ? getWorkingDaysPrecise(finishDate, dClient) : 0;
            const isDelay = margin < 0;
            const marginAbs = round05Up(Math.abs(margin));

            let displayFinishDate = finishDate;
            if (isDelay && dClient && fmt(finishDate) === fmt(dClient)) {
                displayFinishDate = addWorkingDays(finishDate, 1);
            }

            const isMaxRecettePassed = dMaxRecette && now > dMaxRecette;
            const hasUnfinishedExecution = viewTickets.some((t) => {
                const st = t.statusExecution || 'À exécuter';
                return st !== 'Terminée OK' && st !== 'Terminée KO';
            });
            const maxRecetteAlert = isMaxRecettePassed && hasUnfinishedExecution;
            const maxRecetteColor = maxRecetteAlert
                ? { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' }
                : null;

            setSlot('slotActualDate', 'valActualDate', '', false);
            setSlot(
                'slotMaxRecetteDate',
                'valMaxRecetteDate',
                maxRecetteStr,
                !!dClient && !isDelay,
                maxRecetteColor
            );
            setSlot('slotPossibleDate', 'valPossibleDate', fmt(displayFinishDate), true);

            if (dClient) {
                const color = isDelay
                    ? { bg: 'rgba(239, 68, 68, 0.08)', text: '#ef4444' }
                    : { bg: 'rgba(16, 185, 129, 0.08)', text: '#10b981' };

                setSlot(
                    'slotMargin',
                    'valMargin',
                    `${marginAbs.toFixed(1)} j`,
                    true,
                    color,
                    'labelMargin',
                    isDelay ? 'Retard' : 'Marge'
                );

                if (isDelay) {
                    if (riskText) {
                        riskText.textContent = `Retard estimé à ${marginAbs.toFixed(2)} ${marginAbs <= 1 ? 'jour' : 'jours'}, livraison client possible le ${fmt(displayFinishDate)}`;
                        riskText.style.color = '#ef4444';
                    }
                    if (riskIcon) {
                        riskIcon.innerHTML = '<i data-lucide="alert-triangle"></i>';
                        riskIcon.style.background = 'rgba(239, 68, 68, 0.1)';
                        riskIcon.style.color = '#ef4444';
                    }
                } else {
                    if (riskText) {
                        if (maxRecetteAlert) {
                            riskText.textContent = `Livraison client OK, mais retard sur le début de recette (date max : ${fmt(dMaxRecette)})`;
                            riskText.style.color = '#f59e0b';
                        } else {
                            riskText.textContent = `Livraison client possible le ${fmt(displayFinishDate)}`;
                            riskText.style.color = '#10b981';
                        }
                    }
                    if (riskIcon) {
                        if (maxRecetteAlert) {
                            riskIcon.innerHTML = '<i data-lucide="alert-circle"></i>';
                            riskIcon.style.background = 'rgba(245, 158, 11, 0.1)';
                            riskIcon.style.color = '#f59e0b';
                        } else {
                            riskIcon.innerHTML = '<i data-lucide="check-circle"></i>';
                            riskIcon.style.background = 'rgba(16, 185, 129, 0.1)';
                            riskIcon.style.color = '#10b981';
                        }
                    }
                }
            } else {
                setSlot('slotMargin', 'valMargin', '', false);
                if (riskText) {
                    riskText.textContent = 'Date de livraison client non définie';
                    riskText.style.color = 'var(--text-muted)';
                }
            }
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
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

    renderCharts(
        statusObj,
        workloadPairs,
        { advC, advE, totalJConception, totalJExecution, doneJConception, doneJExecution },
        viewTickets.length,
        statusCount
    );
}

function renderCharts(statusObj, workloadPairs, progressData, totalTickets, statusCount) {
    const STATUS_COLORS = {
        Terminée: ['#10b981', '#059669'],
        'Terminée OK': ['#10b981', '#059669'],
        'Terminée KO': ['#ef4444', '#dc2626'],
        'En cours': ['#3b82f6', '#2563eb'],
        "En cours d'exécution": ['#3b82f6', '#2563eb'],
        Bloquée: ['#f43f5e', '#e11d48'],
        'À faire': ['#94a3b8', '#64748b'],
        'À exécuter': ['#94a3b8', '#64748b'],
        'En attente livraison': ['#f59e0b', '#d97706'],
        Rejeté: ['#1e293b', '#0f172a']
    };

    const getStatusColor = (status, isStart = true) => {
        if (STATUS_COLORS[status])
            return isStart ? STATUS_COLORS[status][0] : STATUS_COLORS[status][1];
        // Generate a deterministic color if unknown
        let hash = 0;
        for (let i = 0; i < status.length; i++) hash = status.charCodeAt(i) + ((hash << 5) - hash);
        const c = (hash & 0x00ffffff).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    };
    // ---- Color palette with gradients ----
    const createGradient = (ctx, colorStart, colorEnd, horizontal = false) => {
        const chart = ctx.chart;
        const { top, bottom, left, right } = chart.chartArea || {
            top: 0,
            bottom: 400,
            left: 0,
            right: 400
        };
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
            ticks: {
                stepSize: 1,
                precision: 0,
                font: { family: 'Inter', size: 11, weight: '500' },
                color: '#64748b'
            }
        }
    });

    const applyChartConf = (id, type, data, options) => {
        if (chartInstances[id]) {
            chartInstances[id].destroy();
        }
        const canvasEl = document.getElementById(id);
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        Chart.defaults.color = textCol;
        Chart.defaults.font.family = 'Inter';
        chartInstances[id] = new Chart(ctx, { type, data, options });
    };

    // Helper for stacked bar charts
    const applyStackedStatusChart = (id, labels, dataMap, activeStatuses) => {
        const datasets = activeStatuses
            .map((status) => {
                return {
                    label: status,
                    data: labels.map((l) => dataMap[l][status] || 0),
                    backgroundColor: (ctx) => {
                        try {
                            return createGradient(
                                ctx,
                                getStatusColor(status),
                                getStatusColor(status, false)
                            );
                        } catch (e) {
                            return getStatusColor(status);
                        }
                    },
                    borderRadius: 8,
                    borderSkipped: false
                };
            })
            .filter((ds) => ds.data.some((v) => v > 0)); // Only show if at least one bar has this status

        applyChartConf(
            id,
            'bar',
            { labels, datasets },
            {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: modernTooltip,
                    legend: {
                        labels: {
                            font: { family: 'Inter', size: 10 },
                            usePointStyle: true,
                            pointStyle: 'rectRounded',
                            padding: 12
                        }
                    }
                },
                scales: modernScales(true)
            }
        );
    };

    // Design Charts
    const typeLabels = Object.keys(statusObj.designByType);
    const featLabels = Object.keys(statusObj.designByFeat);

    applyStackedStatusChart(
        'chartTypeDesign',
        typeLabels,
        statusObj.designByType,
        statusObj.activeDesignStatuses
    );
    applyStackedStatusChart(
        'chartFeatureDesign',
        featLabels,
        statusObj.designByFeat,
        statusObj.activeDesignStatuses
    );

    // Execution Charts
    const typeLabelsExec = Object.keys(statusObj.execByType);
    const featLabelsExec = Object.keys(statusObj.execByFeat);

    applyStackedStatusChart(
        'chartTypeExec',
        typeLabelsExec,
        statusObj.execByType,
        statusObj.activeExecStatuses
    );
    applyStackedStatusChart(
        'chartFeatureExec',
        featLabelsExec,
        statusObj.execByFeat,
        statusObj.activeExecStatuses
    );

    // ==== Chart 3: Progress Conception vs Exécution (grouped bar) ====
    applyChartConf(
        'chartProgress',
        'bar',
        {
            labels: ['Conception', 'Exécution'],
            datasets: [
                {
                    label: 'Réalisé (J/h)',
                    data: [progressData.doneJConception, progressData.doneJExecution],
                    backgroundColor: (ctx) => {
                        try {
                            return createGradient(ctx, '#34d399', '#10b981');
                        } catch (e) {
                            return '#10b981';
                        }
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
                        try {
                            return createGradient(ctx, '#cbd5e1', '#94a3b8');
                        } catch (e) {
                            return '#94a3b8';
                        }
                    },
                    borderRadius: 8,
                    borderSkipped: false
                }
            ]
        },
        {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: modernTooltip,
                legend: {
                    labels: {
                        font: { family: 'Inter', size: 11 },
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        padding: 16
                    }
                }
            },
            scales: modernScales(true)
        }
    );

    // ==== Chart 4: Doughnut with center text ====
    const statusLabels = Object.keys(statusCount);
    const doughnutColors = [
        '#6366f1',
        '#10b981',
        '#f59e0b',
        '#ef4444',
        '#0ea5e9',
        '#8b5cf6',
        '#ec4899',
        '#14b8a6',
        '#f97316',
        '#64748b'
    ];

    // Center text plugin
    const centerTextPlugin = {
        id: 'centerText',
        afterDraw(chart) {
            if (chart.config.type !== 'doughnut') return;
            const {
                ctx,
                chartArea: { width, height, top }
            } = chart;
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

    applyChartConf(
        'chartStatus',
        'doughnut',
        {
            labels: statusLabels,
            datasets: [
                {
                    data: statusLabels.map((l) => statusCount[l]),
                    backgroundColor: statusLabels.map(
                        (_, i) => doughnutColors[i % doughnutColors.length]
                    ),
                    borderWidth: 0,
                    hoverOffset: 8
                }
            ]
        },
        {
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
        }
    );

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
                    datasets: [
                        {
                            data: statusLabels.map((l) => statusCount[l]),
                            backgroundColor: statusLabels.map(
                                (_, i) => doughnutColors[i % doughnutColors.length]
                            ),
                            borderWidth: 0,
                            hoverOffset: 8
                        }
                    ]
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
    const workloadLabels = workloadPairs.map((w) => w.name);

    applyChartConf(
        'chartWorkload',
        'bar',
        {
            labels: workloadLabels,
            datasets: [
                {
                    label: 'Conception',
                    data: workloadPairs.map((w) => w.c),
                    backgroundColor: (ctx) => {
                        try {
                            return createGradient(ctx, '#34d399', '#10b981', true);
                        } catch (e) {
                            return '#10b981';
                        }
                    },
                    borderRadius: 4,
                    borderSkipped: false,
                    barThickness: 28
                },
                {
                    label: 'Exécution',
                    data: workloadPairs.map((w) => w.e),
                    backgroundColor: (ctx) => {
                        try {
                            return createGradient(ctx, '#38bdf8', '#0ea5e9', true);
                        } catch (e) {
                            return '#0ea5e9';
                        }
                    },
                    borderRadius: 4,
                    borderSkipped: false,
                    barThickness: 28
                }
            ]
        },
        {
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
                    labels: {
                        font: { family: 'Inter', size: 11 },
                        usePointStyle: true,
                        pointStyle: 'rectRounded'
                    }
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
        }
    );
}

function updateUI() {
    renderTicketsTable();
    if (activeTab === 'dashboard') {
        renderDashboard();
    }
}

// Window resize handling
window.addEventListener('resize', updateStickyOffsets);

// Boot handled by index.html (DOMContentLoaded)
