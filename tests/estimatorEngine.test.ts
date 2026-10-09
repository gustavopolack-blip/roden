/**
 * Preservación de las reglas de costos.
 * tests/fixtures/engine.baseline.json se generó con el código ANTERIOR a extraer el motor
 * (commit 4fee4d4, funciones dentro de pages/CostEstimator.tsx). Si alguna regla de despiece,
 * cantidades o precios cambia, estas pruebas fallan.
 */
import { describe, it, expect } from 'vitest';
import baseline from './fixtures/engine.baseline.json';
import { buildStandardModules, buildSpecialModules, buildManualModule, buildItems, TEST_SNAPSHOT } from './fixtures/moduleMatrix.mjs';
import { SPECIAL_MODULE_TEMPLATES } from '../utils/specialModules';
import {
  calculateModuleParts, calculateItemQuantities, computeItemFinancials,
  getRecalculatedItemPrices, getBoardLabel,
} from '../utils/estimatorEngine';

const roundTrip = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const modules = [...buildStandardModules(), ...buildSpecialModules(SPECIAL_MODULE_TEMPLATES), buildManualModule()];
const items = buildItems(SPECIAL_MODULE_TEMPLATES);

describe('motor del estimador: idéntico a la foto previa a la extracción', () => {
  it('cubre la matriz completa (estándar, 19 plantillas especiales y manual)', () => {
    expect(modules.length).toBe(Object.keys(baseline.parts).length);
    expect(SPECIAL_MODULE_TEMPLATES.length).toBe(19);
  });

  it.each(modules.map(m => [m.id, m] as const))('despiece y etiquetas de placa de %s', (id, mod) => {
    const parts = calculateModuleParts(mod as any);
    expect(roundTrip(parts)).toEqual((baseline.parts as any)[id]);
    expect(parts.map(p => getBoardLabel(mod, p))).toEqual((baseline.labels as any)[id]);
  });

  it.each(items.map(i => [i.id, i] as const))('cantidades, costos y escenarios del ítem %s', (id, item) => {
    expect(roundTrip(calculateItemQuantities(item.modules as any))).toEqual((baseline.quantities as any)[id]);
    const f: any = computeItemFinancials(item, TEST_SNAPSHOT, null);
    delete f.q;
    expect(roundTrip(f)).toEqual((baseline.financials as any)[id]);
    expect(roundTrip(getRecalculatedItemPrices(item as any, TEST_SNAPSHOT))).toEqual((baseline.prices as any)[id]);
  });
});
