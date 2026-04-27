// utils.js
// Fonctions utilitaires pures découplées du DOM

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
    const jConception = round015Up(ticket.nbTestCases / project.designRatio);
    const jExecution = round015Up(ticket.nbTestCases / project.executionRatio);
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

// Export pour l'environnement de test (Vitest/Node)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        round015Up,
        round05Up,
        formatFrenchFloat,
        getCalculations
    };
}
