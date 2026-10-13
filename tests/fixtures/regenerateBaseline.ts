/**
 * Regenera tests/fixtures/engine.baseline.json con el motor ACTUAL.
 * Usar solo cuando una regla de cálculo cambia a propósito, y explicar el cambio en el commit.
 *   npx tsx tests/fixtures/regenerateBaseline.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-ignore — matriz en JS plano
import { buildStandardModules, buildSpecialModules, buildManualModule, buildItems, TEST_SNAPSHOT } from './moduleMatrix.mjs';
import { SPECIAL_MODULE_TEMPLATES } from '../../utils/specialModules';
import {
  calculateModuleParts, calculateItemQuantities, computeItemFinancials, getRecalculatedItemPrices, getBoardLabel,
} from '../../utils/estimatorEngine';

const modules = [...buildStandardModules(), ...buildSpecialModules(SPECIAL_MODULE_TEMPLATES), buildManualModule()];
const items = buildItems(SPECIAL_MODULE_TEMPLATES);
const out: any = { parts: {}, labels: {}, quantities: {}, financials: {}, prices: {} };
for (const m of modules) {
  const parts = calculateModuleParts(m);
  out.parts[m.id] = parts;
  out.labels[m.id] = parts.map((p: any) => getBoardLabel(m, p));
}
for (const it of items) {
  out.quantities[it.id] = calculateItemQuantities(it.modules);
  const f: any = computeItemFinancials(it, TEST_SNAPSHOT, null);
  delete f.q;
  out.financials[it.id] = f;
  out.prices[it.id] = getRecalculatedItemPrices(it as any, TEST_SNAPSHOT);
}
const path = fileURLToPath(new URL('./engine.baseline.json', import.meta.url));
writeFileSync(path, JSON.stringify(JSON.parse(JSON.stringify(out)), null, 1));
console.log('Foto regenerada:', path);
