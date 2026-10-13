/**
 * Clasificación de plantillas en los botones del estimador: Módulos (cajas) y Piezas (sueltas).
 */
import { describe, it, expect } from 'vitest';
import { SPECIAL_MODULE_TEMPLATES, getTemplate, floatingShelfBrackets, floatingShelfBracketLength } from '../utils/specialModules';
import { calculateItemQuantities, hwPriceFor, bracketLabel } from '../utils/estimatorEngine';

const ids = (g: string) => SPECIAL_MODULE_TEMPLATES.filter(t => t.group === g).map(t => t.id).sort();

describe('grupos de plantillas', () => {
  it('toda plantilla está en Módulos o en Piezas (si no, no aparece en ningún botón)', () => {
    SPECIAL_MODULE_TEMPLATES.forEach(t => expect(['MODULO', 'PIEZA']).toContain(t.group));
  });
  it('Módulos: las cajas', () => {
    expect(ids('MODULO')).toEqual([
      'BIBLIOTECA', 'BOTINERO_EXTRAIBLE', 'BOTINERO_FIJO', 'COLUMNA', 'ESQUINERO', 'ESQUINERO_EN_L',
      'HORNO_EMPOTRADO', 'MICROONDAS_COLUMNA', 'MODULO_ABIERTO', 'MODULO_BAJO_MESADA', 'MODULO_HORIZONTAL',
    ]);
  });
  it('plantillas reemplazadas por variantes del estándar: ocultas en el formulario', () => {
    expect(SPECIAL_MODULE_TEMPLATES.filter(t => t.legacy).map(t => t.id).sort()).toEqual(
      ['BIBLIOTECA', 'BOTINERO_EXTRAIBLE', 'BOTINERO_FIJO', 'ESQUINERO', 'MODULO_ABIERTO', 'MODULO_BAJO_MESADA']);
  });
  it('Piezas: las piezas sueltas', () => {
    expect(ids('PIEZA')).toEqual([
      'AJUSTE', 'DIVISOR_VERTICAL', 'ESTANTE_18MM', 'ESTANTE_FLOTANTE', 'LATERAL_APLICADO',
      'PANEL_ENLISTONADO', 'PANEL_LISO', 'PUERTA_18MM', 'TAPA_HORIZONTAL', 'ZOCALO_APLICADO', 'ZOCALO_ESTRUCTURAL',
    ]);
  });
});

describe('estante 36mm flotante (ménsulas metálicas ocultas)', () => {
  it('2 ménsulas hasta 900mm de ancho; +1 cada 400mm a partir de ahí', () => {
    const casos: [number, number][] = [[400, 2], [900, 2], [901, 3], [910, 3], [1300, 3], [1301, 4], [1310, 4], [1700, 4], [1710, 5], [2400, 6]];
    casos.forEach(([w, n]) => expect([w, floatingShelfBrackets(w)]).toEqual([w, n]));
  });
  const tpl = getTemplate('ESTANTE_FLOTANTE')!;
  it('flotante (o sin opción guardada) lleva ménsulas; no flotante, no', () => {
    expect(tpl.calculate({ width: 1200, height: 36, depth: 250 }, { flotante: 'SI' }).hardware).toEqual({ brackets: 3, bracketLength: 250 });
    expect(tpl.calculate({ width: 1200, height: 36, depth: 250 }).hardware).toEqual({ brackets: 3, bracketLength: 250 });
    expect(tpl.calculate({ width: 1200, height: 36, depth: 250 }, { flotante: 'NO' }).hardware).toEqual({});
  });
  it('largo de ménsula según profundidad: < 250mm → 15cm; 250mm o más → 25cm', () => {
    expect([150, 200, 249, 250, 300].map(floatingShelfBracketLength)).toEqual([150, 150, 150, 250, 250]);
  });
  it('las ménsulas se cuentan por unidad del módulo y se cobran con el precio de su largo', () => {
    const r = tpl.calculate({ width: 1200, height: 36, depth: 250 }, { flotante: 'SI' });
    const mod: any = {
      id: 'e', name: 'Estante', width: 1200, height: 36, depth: 250, quantity: 2, cntDoors: 0, cntFlaps: 0, cntDrawers: 0,
      moduleType: 'SPECIAL', isSpecialModule: true, specialTemplateId: 'ESTANTE_FLOTANTE', specialOptions: { flotante: 'SI' },
      specialParts: r.parts, specialHardware: r.hardware, specialLaborDays: r.laborDays, extras: [],
    };
    expect(calculateItemQuantities([mod]).detailedHardware).toEqual({ 'Ménsula metálica oculta 25cm': 6 });
    const S = { priceFloatingBracket15: 3000, priceFloatingBracket25: 5000 };
    expect(hwPriceFor(bracketLabel(250), 6, S)).toBe(30000);
    expect(hwPriceFor(bracketLabel(150), 6, S)).toBe(18000);
    expect(hwPriceFor(bracketLabel(250), 6, {})).toBe(0);
  });
});
