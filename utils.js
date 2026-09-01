// utils.js
// Fonctions utilitaires pures découplées du DOM

// Échappe une valeur destinée à être injectée dans du HTML (texte ou attribut).
// À utiliser sur TOUTE donnée dynamique interpolée dans un template `innerHTML`.
function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

function getCalculations(ticket, project) {
    if (!project) return { jConception: '0,00', jExecution: '0,00', raf: '0,00' };
    const nbTestCases = ticket.nbTestCases || 0; // évite la propagation de NaN
    const jConception = round015Up(nbTestCases / project.designRatio);
    const jExecution = round015Up(nbTestCases / project.executionRatio);
    const consumed = ticket.consumed || 0;

    // Calcul du RAF par phase (on consomme d'abord la conception puis l'exécution)
    let rafC = 0;
    if (ticket.statusDesign !== 'Terminée') {
        rafC = Math.max(0, jConception - consumed);
    }

    let rafE = 0;
    if (ticket.statusExecution !== 'Terminée OK' && ticket.statusExecution !== 'Terminée KO') {
        const consumedForE = Math.max(0, consumed - jConception);
        rafE = Math.max(0, jExecution - consumedForE);
    }

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

// Seuils de charge (jours-homme) d'un ticket : jC = conception, jE = exécution.
// Fonction pure — la résolution du projet depuis le Store est faite par l'appelant.
function computeThresholds(ticket, project) {
    if (!project) return { jC: 0, jE: 0 };
    const nbTestCases = ticket.nbTestCases || 0;
    return {
        jC: round015Up(nbTestCases / project.designRatio),
        jE: round015Up(nbTestCases / project.executionRatio)
    };
}

// Déduit les statuts (conception / exécution) à partir du consommé saisi.
// Règle métier : on consomme d'abord la conception (jC), puis l'exécution (jE).
function deriveStatusesOnConsumed(consumed, jC, jE) {
    const eps = 0.001;
    if (consumed === 0) {
        return { statusDesign: 'À faire', statusExecution: 'À exécuter' };
    }
    const statusDesign = consumed < jC - eps ? 'En cours' : 'Terminée';
    let statusExecution;
    if (consumed <= jC + eps) {
        statusExecution = 'En attente livraison';
    } else if (consumed >= jC + jE - eps) {
        statusExecution = 'Terminée OK';
    } else {
        statusExecution = "En cours d'exécution";
    }
    return { statusDesign, statusExecution };
}

// Export pour l'environnement de test (Vitest/Node)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        round015Up,
        round05Up,
        formatFrenchFloat,
        getCalculations,
        computeThresholds,
        deriveStatusesOnConsumed
    };
}
