// calc-dates.js — Jours feries FR et calcul de jours ouvres
// (extrait de l'ancien app.js, chargement en scope global classique)

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
    if (daysToAdd === 0) return new Date(startDate);
    
    let result = new Date(startDate);
    const direction = daysToAdd > 0 ? 1 : -1;
    const daysToIterate = Math.ceil(Math.abs(daysToAdd));
    const cachedHolidays = {};

    let count = 0;
    while (count < daysToIterate) {
        result.setDate(result.getDate() + direction);
        const year = result.getFullYear();
        if (!cachedHolidays[year]) cachedHolidays[year] = getFrenchHolidays(year);
        
        const dayOfWeek = result.getDay();
        const timeAtMidnight = new Date(result).setHours(0, 0, 0, 0);
        const isHoliday = cachedHolidays[year].includes(timeAtMidnight);

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday) {
            count++;
        }
    }
    return result;
}

// --- Calcul précis des jours ouvrés (float) entre deux dates (hors weekends/fériés) ---
function getWorkingDaysPrecise(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    const isNegative = startDate > endDate;
    let start = isNegative ? new Date(endDate) : new Date(startDate);
    let end = isNegative ? new Date(startDate) : new Date(endDate);
    
    let days = 0;
    let tempDate = new Date(start);
    const cachedHolidays = {};
    
    while (tempDate < end) {
        const nextDay = new Date(tempDate);
        nextDay.setDate(tempDate.getDate() + 1);
        nextDay.setHours(0, 0, 0, 0); 
        
        let chunkEnd = nextDay < end ? nextDay : end;
        
        const year = tempDate.getFullYear();
        if (!cachedHolidays[year]) cachedHolidays[year] = getFrenchHolidays(year);
        
        const dayOfWeek = tempDate.getDay();
        const timeAtMidnight = new Date(tempDate).setHours(0, 0, 0, 0);

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !cachedHolidays[year].includes(timeAtMidnight)) {
            days += (chunkEnd - tempDate) / (1000 * 3600 * 24);
        }
        
        tempDate = nextDay;
    }
    return isNegative ? -days : days;
}

