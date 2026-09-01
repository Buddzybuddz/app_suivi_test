import { describe, it, expect } from 'vitest';
import dates from './calc-dates.js';
const { getFrenchHolidays, addWorkingDays, getWorkingDaysPrecise } = dates;

const midnight = (y, m, d) => new Date(y, m, d).setHours(0, 0, 0, 0);

describe('calc-dates', () => {
    describe('getFrenchHolidays', () => {
        it('returns the 11 French public holidays for a year', () => {
            const h = getFrenchHolidays(2025);
            expect(h).toHaveLength(11);
        });

        it('includes the fixed holidays', () => {
            const h = getFrenchHolidays(2025);
            expect(h).toContain(midnight(2025, 0, 1)); // Jour de l'an
            expect(h).toContain(midnight(2025, 4, 1)); // Fête du Travail
            expect(h).toContain(midnight(2025, 11, 25)); // Noël
        });

        it('computes the movable feasts from Easter', () => {
            // Pâques 2025 = 20 avril -> lundi de Pâques 21 avril, Ascension 29 mai, lundi de Pentecôte 9 juin
            const h = getFrenchHolidays(2025);
            expect(h).toContain(midnight(2025, 3, 21));
            expect(h).toContain(midnight(2025, 4, 29));
            expect(h).toContain(midnight(2025, 5, 9));
        });
    });

    describe('addWorkingDays', () => {
        it('returns a copy of the start date when adding 0', () => {
            const start = new Date(2025, 5, 2);
            const r = addWorkingDays(start, 0);
            expect(r.getTime()).toBe(start.getTime());
            expect(r).not.toBe(start);
        });

        it('skips weekends', () => {
            // vendredi 6 juin 2025 + 1 jour ouvré -> lundi 9 juin... mais c'est lundi de Pentecôte
            // -> mardi 10 juin
            const r = addWorkingDays(new Date(2025, 5, 6), 1);
            expect(r.getFullYear()).toBe(2025);
            expect(r.getMonth()).toBe(5);
            expect(r.getDate()).toBe(10);
        });

        it('goes backwards for negative amounts', () => {
            // lundi 10 juin 2025 - 1 jour ouvré -> vendredi 6 juin (samedi/dimanche + lundi férié sautés)
            const r = addWorkingDays(new Date(2025, 5, 10), -1);
            expect(r.getDate()).toBe(6);
        });
    });

    describe('getWorkingDaysPrecise', () => {
        it('returns 0 when a bound is missing', () => {
            expect(getWorkingDaysPrecise(null, new Date())).toBe(0);
        });

        it('counts full working days across a normal week', () => {
            // lundi 2 -> vendredi 6 juin 2025 = 4 jours ouvrés
            expect(getWorkingDaysPrecise(new Date(2025, 5, 2), new Date(2025, 5, 6))).toBeCloseTo(
                4
            );
        });

        it('excludes weekends', () => {
            // vendredi 6 -> lundi 9 juin 2025 = 1 (vendredi seul, samedi/dimanche exclus)
            expect(getWorkingDaysPrecise(new Date(2025, 5, 6), new Date(2025, 5, 9))).toBeCloseTo(
                1
            );
        });

        it('is negative when the range is reversed', () => {
            const fwd = getWorkingDaysPrecise(new Date(2025, 5, 2), new Date(2025, 5, 6));
            const bwd = getWorkingDaysPrecise(new Date(2025, 5, 6), new Date(2025, 5, 2));
            expect(bwd).toBeCloseTo(-fwd);
        });
    });
});
