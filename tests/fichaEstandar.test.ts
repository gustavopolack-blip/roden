/**
 * Ficha constructiva del módulo estándar (CATALOGO_PIEZAS.md, definida con Gustavo el 13/10/2026):
 * despiece, herrajes y precios.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateModuleParts, calculateItemQuantities, visibleEdgeLength, hwPriceFor, drawerBoxHeightFor,
  LEG_LABEL, SHELF_SUPPORT_LABEL,
} from '../utils/estimatorEngine';

const BASE = {
  width: 600, height: 720, depth: 580, quantity: 1, cntDoors: 0, cntFlaps: 0, cntDrawers: 0,
  moduleType: 'MELAMINE_FULL', isWhiteStructure: false, backingType: '3MM_WHITE', edgeCategory: 'PVC_045',
  structureCore: 'AGLO', frontsCore: 'AGLO', extras: [], calculateHinges: true, calculateSlides: true,
};
const parts = (over: any = {}) => calculateModuleParts({ ...BASE, id: 'm', name: 'm', ...over } as any);
const part = (over: any, name: string) => parts(over).find(p => p.name === name)!;
const size = (p: any) => [p.width, p.height];

describe('caja y fondos', () => {
  it('tapa y base sobre laterales; laterales siempre a profundidad D', () => {
    expect(size(part({}, 'Tapa superior'))).toEqual([600, 580]);
    expect(size(part({}, 'Lateral'))).toEqual([580, 684]);
    expect(size(part({ backingType: '55_COLOR' }, 'Lateral'))).toEqual([580, 684]);
    expect(size(part({ backingType: '18MM_STRUCTURE' }, 'Lateral'))).toEqual([580, 684]);
  });
  it('laterales enteros: laterales H × D, tapa y base (W − 36) × D', () => {
    expect(size(part({ fullHeightSides: true }, 'Lateral'))).toEqual([580, 720]);
    expect(size(part({ fullHeightSides: true }, 'Tapa superior'))).toEqual([564, 580]);
    expect(size(part({ fullHeightSides: true }, 'Base inferior'))).toEqual([564, 580]);
  });
  it('fondo 3 mm en ranura: (W − 28) × (H − 28)', () => {
    expect(size(part({}, 'Fondo 3mm Blanco'))).toEqual([572, 692]);
  });
  it('fondo 5,5 mm en rebaje: (W − 10) × (H − 10)', () => {
    expect(size(part({ backingType: '55_COLOR' }, 'Fondo 5.5mm Color'))).toEqual([590, 710]);
  });
  it('fondo estructural 18 mm dentro de la caja: (W − 36) × (H − 36)', () => {
    expect(size(part({ backingType: '18MM_STRUCTURE' }, 'Fondo Estructural 18mm'))).toEqual([564, 684]);
  });
});

describe('estantes', () => {
  it('profundidad = D − fondo − 10 mm (− 18 con frentes embutidos)', () => {
    const d = (over: any) => part({ height: 1200, ...over }, 'Estante Interno').height;
    expect(d({})).toBe(549);                              // 580 − (18 + 3) − 10
    expect(d({ backingType: '55_COLOR' })).toBe(564.5);
    expect(d({ backingType: '18MM_STRUCTURE' })).toBe(552);
    expect(d({ backingType: 'NONE' })).toBe(570);
    expect(d({ insetFronts: true })).toBe(531);
  });
  it('cantidad: 1 si H > 850 y uno más cada 350 mm', () => {
    expect(parts({ height: 850 }).some(p => p.name === 'Estante Interno')).toBe(false);
    expect(part({ height: 1200 }, 'Estante Interno').quantity).toBe(2);
  });
  it('regulables: 2 mm más angostos y 4 soportes por estante, sin costo', () => {
    expect(part({ height: 1200, adjustableShelves: true }, 'Estante Interno').width).toBe(562);
    const q = calculateItemQuantities([{ ...BASE, id: 'r', name: 'r', height: 1200, adjustableShelves: true, quantity: 2 } as any]);
    expect(q.detailedHardware[SHELF_SUPPORT_LABEL]).toBe(16);
    expect(hwPriceFor(SHELF_SUPPORT_LABEL, 16, { priceHingeStandard: 999, priceLeg: 999 })).toBe(0);
  });
});

describe('frentes', () => {
  it('superpuestos: 2 mm al borde y 4 mm entre puertas', () => {
    expect(size(part({ cntDoors: 1 }, 'Puerta'))).toEqual([596, 716]);
    expect(size(part({ cntDoors: 2 }, 'Puerta'))).toEqual([296, 716]);
    expect(part({ cntDoors: 3, width: 1200 }, 'Puerta').width).toBeCloseTo((1196 - 8) / 3);
  });
  it('embutidos: hueco interior con 4 mm de luz contra la caja y entre frentes', () => {
    expect(size(part({ cntDoors: 1, insetFronts: true }, 'Puerta'))).toEqual([556, 676]);
    expect(size(part({ cntDoors: 2, insetFronts: true }, 'Puerta'))).toEqual([276, 676]);
  });
  it('cajones: 4 mm entre frentes', () => {
    const f = part({ cntDrawers: 3 }, 'Frente Cajón');
    expect(f.height).toBeCloseTo((716 - 8) / 3);
  });
});

describe('cajones', () => {
  it('alto interior de la caja según el alto del frente', () => {
    expect([100, 159, 160, 239, 240, 339, 340, 500].map(drawerBoxHeightFor)).toEqual([80, 80, 120, 120, 200, 200, 300, 300]);
    expect(part({ cntDrawers: 3 }, 'Lateral Cajón').height).toBe(120);       // frentes de 236
    expect(part({ cntDrawers: 4 }, 'Lateral Cajón').height).toBe(120);       // frentes de (716 − 12)/4 = 176
  });
  it('largo de caja D − 20; con frente embutido 18 mm menos', () => {
    expect(part({ cntDrawers: 2 }, 'Lateral Cajón').width).toBe(560);
    expect(part({ cntDrawers: 2, insetFronts: true }, 'Lateral Cajón').width).toBe(542);
  });
});

describe('patas', () => {
  it('4 hasta 900 mm de ancho, 6 a partir de ahí; se cobran con priceLeg', () => {
    const q = (width: number) => calculateItemQuantities([{ ...BASE, id: 'p', name: 'p', width, hasLegs: true } as any]).detailedHardware[LEG_LABEL];
    expect([q(600), q(900), q(901)]).toEqual([4, 4, 6]);
    expect(hwPriceFor(LEG_LABEL, 6, { priceLeg: 2500 })).toBe(15000);
  });
});

describe('veta', () => {
  it('con veta: paralela al lado mayor; lisa: libre; sin dato: la de antes', () => {
    const g = (over: any, name: string) => part(over, name).grain;
    expect([g({ structureHasGrain: true }, 'Lateral'), g({ structureHasGrain: true }, 'Tapa superior')]).toEqual(['vertical', 'horizontal']);
    expect(g({ structureHasGrain: false }, 'Lateral')).toBe('free');
    expect(g({}, 'Lateral')).toBe('vertical');
    expect(g({ cntDoors: 2, frontsHaveGrain: true }, 'Puerta')).toBe('vertical');
    expect(g({ cntDoors: 2 }, 'Puerta')).toBe('horizontal');
  });
  it('el tapacanto va por el canto frontal aunque la veta sea libre', () => {
    expect(visibleEdgeLength(part({ structureHasGrain: false }, 'Lateral'))).toBe(684);
    expect(visibleEdgeLength(part({ structureHasGrain: false }, 'Tapa superior'))).toBe(600);
  });
});

describe('opciones del estándar en plantillas', () => {
  it('una plantilla con patas o estantes regulables tildados (quedaron del formulario) no los cobra', () => {
    const q = calculateItemQuantities([{ ...BASE, id: 's', name: 's', isSpecialModule: true, specialTemplateId: 'MODULO_ABIERTO',
      specialParts: [{ name: 'Estante interno', width: 500, height: 400, material: '18mm_Carcass', quantity: 2, grain: 'horizontal' }],
      specialHardware: {}, hasLegs: true, adjustableShelves: true } as any]);
    expect(q.detailedHardware[LEG_LABEL]).toBeUndefined();
    expect(q.detailedHardware[SHELF_SUPPORT_LABEL]).toBeUndefined();
  });
});
