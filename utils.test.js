import { describe, it, expect } from 'vitest';
import utils from './utils.js';
const {
    escapeHtml,
    round015Up,
    round05Up,
    formatFrenchFloat,
    getCalculations,
    computeThresholds,
    deriveStatusesOnConsumed
} = utils;

describe('Utils', () => {
    describe('escapeHtml', () => {
        it('should return empty string for undefined or null', () => {
            expect(escapeHtml(undefined)).toBe('');
            expect(escapeHtml(null)).toBe('');
        });

        it('should neutralize HTML-significant characters', () => {
            expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
                '&lt;img src=x onerror=alert(1)&gt;'
            );
            expect(escapeHtml('"><script>')).toBe('&quot;&gt;&lt;script&gt;');
            expect(escapeHtml("O'Brien & fils")).toBe('O&#39;Brien &amp; fils');
        });

        it('should coerce non-string values', () => {
            expect(escapeHtml(42)).toBe('42');
            expect(escapeHtml(0)).toBe('0');
        });
    });

    describe('round015Up', () => {
        it('should round up to the nearest multiple of 0.15', () => {
            expect(round015Up(0)).toBe(0);
            expect(round015Up(0.1)).toBeCloseTo(0.15);
            expect(round015Up(0.15)).toBeCloseTo(0.15);
            expect(round015Up(0.16)).toBeCloseTo(0.3);
            expect(round015Up(1.0)).toBeCloseTo(1.05);
        });
    });

    describe('round05Up', () => {
        it('should round up to the nearest multiple of 0.5', () => {
            expect(round05Up(0)).toBe(0);
            expect(round05Up(0.2)).toBeCloseTo(0.5);
            expect(round05Up(0.5)).toBeCloseTo(0.5);
            expect(round05Up(0.6)).toBeCloseTo(1.0);
            expect(round05Up(1.1)).toBeCloseTo(1.5);
        });
    });

    describe('formatFrenchFloat', () => {
        it('should return "0,00" for undefined, null, or NaN', () => {
            expect(formatFrenchFloat(undefined)).toBe('0,00');
            expect(formatFrenchFloat(null)).toBe('0,00');
            expect(formatFrenchFloat(NaN)).toBe('0,00');
        });

        it('should format numbers with comma and two decimal places', () => {
            expect(formatFrenchFloat(0)).toBe('0,00');
            expect(formatFrenchFloat(1.5)).toBe('1,50');
            expect(formatFrenchFloat(2.123)).toBe('2,12');
            expect(formatFrenchFloat(2.129)).toBe('2,13');
        });
    });

    describe('getCalculations', () => {
        it('should return zeros if no project is provided', () => {
            const ticket = { nbTestCases: 10 };
            const result = getCalculations(ticket, null);
            expect(result.jConception).toBe('0,00');
            expect(result.jExecution).toBe('0,00');
            expect(result.raf).toBe('0,00');
        });

        it('should calculate initial values without consumption', () => {
            const project = { designRatio: 10, executionRatio: 20 };
            // jC = 15 / 10 = 1.5 => 1.50
            // jE = 15 / 20 = 0.75 => 0.75
            const ticket = { nbTestCases: 15, consumed: 0 };
            const result = getCalculations(ticket, project);
            expect(result.rawJConception).toBe(1.5);
            expect(result.rawJExecution).toBe(0.75);
            expect(result.rawRaf).toBe(2.25);
            expect(result.raf).toBe('2,25');
        });

        it('should consume conception first, then execution', () => {
            const project = { designRatio: 10, executionRatio: 20 };
            // jC = 1.5, jE = 0.75
            // Consumed = 1.0 => 0.5 left for conception, 0.75 for execution -> total 1.25 -> round up to nearest 0.15 => 1.35
            const ticket = {
                nbTestCases: 15,
                consumed: 1.0,
                statusDesign: 'En cours',
                statusExecution: 'À exécuter'
            };
            const result = getCalculations(ticket, project);
            expect(result.rafC).toBe(0.5);
            expect(result.rafE).toBe(0.75);
            expect(result.rawRaf).toBeCloseTo(1.35);
        });

        it('should zero out rafC if design is Terminée', () => {
            const project = { designRatio: 10, executionRatio: 20 };
            // jC = 1.5, jE = 0.75
            // Consumed = 1.0, design finished => rafC = 0.
            // The 1.0 consumed applies fully to C (since C was 1.5). But wait, does the logic handle it this way?
            // consumedForE = Math.max(0, 1.0 - 1.5) = 0.
            // rafE = Math.max(0, 0.75 - 0) = 0.75.
            // total RAF = 0 + 0.75 = 0.75
            const ticket = {
                nbTestCases: 15,
                consumed: 1.0,
                statusDesign: 'Terminée',
                statusExecution: 'À exécuter'
            };
            const result = getCalculations(ticket, project);
            expect(result.rafC).toBe(0);
            expect(result.rafE).toBe(0.75);
            expect(result.rawRaf).toBe(0.75);
        });

        it('should zero out all RAF if both are finished', () => {
            const project = { designRatio: 10, executionRatio: 20 };
            const ticket = {
                nbTestCases: 15,
                consumed: 2.0,
                statusDesign: 'Terminée',
                statusExecution: 'Terminée OK'
            };
            const result = getCalculations(ticket, project);
            expect(result.rafC).toBe(0);
            expect(result.rafE).toBe(0);
            expect(result.rawRaf).toBe(0);
        });
    });

    describe('computeThresholds', () => {
        it('should return zeros without a project', () => {
            expect(computeThresholds({ nbTestCases: 30 }, null)).toEqual({ jC: 0, jE: 0 });
        });

        it('should divide by the ratios and round up to 0.15', () => {
            const project = { designRatio: 10, executionRatio: 20 };
            // 15/10 = 1.5 -> 1.5 ; 15/20 = 0.75 -> 0.75
            expect(computeThresholds({ nbTestCases: 15 }, project)).toEqual({ jC: 1.5, jE: 0.75 });
            // 16/10 = 1.6 -> 1.65 (multiple de 0.15 supérieur)
            expect(computeThresholds({ nbTestCases: 16 }, project).jC).toBeCloseTo(1.65);
        });
    });

    describe('deriveStatusesOnConsumed', () => {
        const jC = 1.5;
        const jE = 0.75; // total = 2.25

        it('resets both statuses when nothing is consumed', () => {
            expect(deriveStatusesOnConsumed(0, jC, jE)).toEqual({
                statusDesign: 'À faire',
                statusExecution: 'À exécuter'
            });
        });

        it('keeps conception "En cours" while below jC', () => {
            expect(deriveStatusesOnConsumed(1.0, jC, jE)).toEqual({
                statusDesign: 'En cours',
                statusExecution: 'En attente livraison'
            });
        });

        it('marks conception "Terminée" once jC is reached, execution waiting', () => {
            expect(deriveStatusesOnConsumed(1.5, jC, jE)).toEqual({
                statusDesign: 'Terminée',
                statusExecution: 'En attente livraison'
            });
        });

        it('puts execution "En cours" between jC and jC+jE', () => {
            expect(deriveStatusesOnConsumed(1.9, jC, jE)).toEqual({
                statusDesign: 'Terminée',
                statusExecution: "En cours d'exécution"
            });
        });

        it('marks execution "Terminée OK" once jC+jE is reached', () => {
            expect(deriveStatusesOnConsumed(2.25, jC, jE)).toEqual({
                statusDesign: 'Terminée',
                statusExecution: 'Terminée OK'
            });
            expect(deriveStatusesOnConsumed(5, jC, jE).statusExecution).toBe('Terminée OK');
        });
    });
});
