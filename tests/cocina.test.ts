/**
 * Módulos de cocina (CATALOGO_PIEZAS.md, ficha del 13/10/2026): bajo mesada, esquinero recto,
 * alacena, horno empotrado y columna. Despiece, herrajes y ubicación 3D.
 */
import { describe, it, expect } from 'vitest';
import { calculateModuleParts, calculateItemQuantities, SHELF_SUPPORT_LABEL } from '../utils/estimatorEngine';
import { placeModule, buildAssembly, findPieceOverlaps, WALL_CABINET_Y } from '../utils/furniture3d/geometry';
import { getTemplate, getFixedDims } from '../utils/specialModules';

const BASE = {
  quantity: 1, cntDoors: 0, cntFlaps: 0, cntDrawers: 0, moduleType: 'MELAMINE_FULL', isWhiteStructure: false,
  backingType: '3MM_WHITE', edgeCategory: 'PVC_045', structureCore: 'AGLO', frontsCore: 'AGLO', extras: [],
  calculateHinges: true, calculateSlides: true,
};
const mod = (over: any) => ({ ...BASE, id: over.id || 'm', name: 'm', ...over });
const bajo = (over: any = {}) => mod({ cabinetType: 'BAJO', width: 800, height: 740, depth: 560, ...over });
const size = (parts: any[], name: string) => { const p = parts.find(x => x.name === name); return p && [p.width, p.height, p.quantity]; };
const special = (id: string, dims: any) => {
  const tpl = getTemplate(id)!;
  const d = { ...dims, ...getFixedDims(tpl, {}) };
  const r = tpl.calculate(d, {});
  return mod({ id, ...d, moduleType: 'SPECIAL', isSpecialModule: true, specialTemplateId: id, specialOptions: {}, specialParts: r.parts, specialHardware: r.hardware });
};

describe('bajo mesada', () => {
  const parts = calculateModuleParts(bajo({ cntDoors: 2 }) as any);
  it('caja: laterales enteros, piso entre laterales, sin tapa y fajas de 100 mm', () => {
    expect(size(parts, 'Lateral')).toEqual([560, 740, 2]);
    expect(size(parts, 'Piso')).toEqual([764, 560, 1]);
    expect(size(parts, 'Faja frontal')).toEqual([764, 100, 1]);
    expect(size(parts, 'Faja trasera')).toEqual([764, 100, 1]);
    expect(parts.some(p => p.name === 'Tapa superior')).toBe(false);
  });
  it('fondo 3 mm hasta el borde superior: (W − 28) × (H − 14)', () => {
    expect(size(parts, 'Fondo 3mm Blanco')).toEqual([772, 726, 1]);
  });
  it('puertas con las reglas del estándar (antes no se generaban) y 1 estante regulable', () => {
    expect(size(parts, 'Puerta')).toEqual([396, 736, 2]);
    expect(size(parts, 'Estante Interno')).toEqual([762, 529, 1]);
    expect(calculateItemQuantities([bajo({ cntDoors: 2 }) as any]).detailedHardware[SHELF_SUPPORT_LABEL]).toBe(4);
  });
  it('cajones con las reglas del estándar, sin estante', () => {
    const p = calculateModuleParts(bajo({ cntDrawers: 3 }) as any);
    expect(p.find(x => x.name === 'Frente Cajón')!.height).toBeCloseTo((736 - 8) / 3);
    expect(p.find(x => x.name === 'Lateral Cajón')!.height).toBe(200);
    expect(p.some(x => x.name === 'Estante Interno')).toBe(false);
  });
  it('3D: fajas arriba, fondo hasta el borde, sin choques; con base se eleva 100 mm', () => {
    const { pieces } = placeModule(bajo({ cntDoors: 2 }));
    const box = (n: string) => pieces.find(p => p.name === n)!.box;
    expect(box('Faja frontal')).toEqual({ min: [18, 722, 460], max: [782, 740, 560] });
    expect(box('Faja trasera')).toEqual({ min: [18, 640, 0], max: [782, 740, 18] });
    expect(box('Fondo 3mm Blanco')).toEqual({ min: [14, 13, 18], max: [786, 739, 21] });
    expect(findPieceOverlaps(pieces)).toEqual([]);
    expect(buildAssembly('x', [bajo({ cntDoors: 2, baseType: 'ZOCALO' })]).size.h).toBe(840);
  });
});

describe('bajo mesada esquinero recto', () => {
  const esq = (over: any = {}) => mod({ cabinetType: 'ESQUINERO', width: 1000, height: 740, depth: 560, ...over });
  it('frente fijo = profundidad del bajo vecino + 21 + 4; puerta = el resto; siempre 1 puerta', () => {
    const p = calculateModuleParts(esq({ neighborDepth: 560, cntDoors: 3, cntDrawers: 2 }) as any);
    expect(size(p, 'Frente fijo esquinero')).toEqual([585, 736, 1]);
    expect(size(p, 'Puerta')).toEqual([407, 736, 1]);
    expect(size(p, 'Estante Interno')).toEqual([962, 529, 1]);
    expect(p.some(x => x.name === 'Frente Cajón')).toBe(false);
    expect(calculateItemQuantities([esq({ cntDoors: 3 }) as any]).totalHinges).toBe(2);
  });
  it('sin bajo vecino cargado usa la propia profundidad', () => {
    expect(calculateModuleParts(esq({ depth: 500 }) as any).find(x => x.name === 'Frente fijo esquinero')!.width).toBe(525);
  });
  it('3D: frente fijo del lado del rincón y puerta con bisagras del lado de afuera', () => {
    const l = placeModule(esq({ neighborDepth: 560 })).pieces;
    expect(l.find(p => p.name === 'Frente fijo esquinero')!.box.min[0]).toBe(2);
    const door = l.find(p => p.name === 'Puerta')!;
    expect([door.box.min[0], door.box.max[0], door.hingeSide]).toEqual([591, 998, 'right']);
    const r = placeModule(esq({ neighborDepth: 560, cornerSide: 'RIGHT' })).pieces;
    expect(r.find(p => p.name === 'Frente fijo esquinero')!.box.max[0]).toBe(998);
    expect(r.find(p => p.name === 'Puerta')!.hingeSide).toBe('left');
    expect(findPieceOverlaps(l)).toEqual([]);
  });
});

describe('alacena', () => {
  const ala = (over: any = {}) => mod({ cabinetType: 'ALACENA', width: 600, height: 700, depth: 320, cntDoors: 2, ...over });
  it('estándar + faja trasera superior de 100 mm; piso de microondas de 420 mm', () => {
    const p = calculateModuleParts(ala() as any);
    expect(size(p, 'Tapa superior')).toEqual([600, 320, 1]);
    expect(size(p, 'Faja trasera')).toEqual([564, 100, 1]);
    expect(size(p, 'Fondo 3mm Blanco')).toEqual([572, 672, 1]);
    expect(size(calculateModuleParts(ala({ microwaveFloor: true }) as any), 'Base inferior')).toEqual([600, 420, 1]);
  });
  it('3D: faja debajo de la tapa; sin posición se cuelga a 1460 mm en su propia fila', () => {
    const { pieces } = placeModule(ala());
    expect(pieces.find(p => p.name === 'Faja trasera')!.box).toEqual({ min: [18, 582, 0], max: [582, 682, 18] });
    expect(findPieceOverlaps(pieces)).toEqual([]);
    const a = buildAssembly('Cocina', [bajo({ id: 'b' }), ala({ id: 'a' })]);
    expect(a.modules.map(m => [m.layout.x, m.layout.y])).toEqual([[0, 0], [0, WALL_CABINET_Y]]);
  });
  it('3D: el piso de microondas sobresale hacia adelante', () => {
    const base = placeModule(ala({ microwaveFloor: true })).pieces.find(p => p.name === 'Base inferior')!;
    expect(base.box.max[2]).toBe(420);
  });
});

describe('horno empotrado y columna', () => {
  it('horno: 595 entre ejes (caja 613 × 613), sin fondo, techo recortado 300 mm atrás', () => {
    const h = special('HORNO_EMPOTRADO', { width: 600, height: 720, depth: 560 });
    expect([h.width, h.height]).toEqual([613, 613]);
    const p = calculateModuleParts(h as any);
    expect(size(p, 'Tapa superior')).toEqual([613, 260, 1]);
    expect(size(p, 'Lateral')).toEqual([560, 577, 2]);
    expect(p.some(x => /^Fondo/.test(x.name))).toBe(false);
    const techo = placeModule(h).pieces.find(x => x.name === 'Tapa superior')!.box;
    expect([techo.min[2], techo.max[2]]).toEqual([300, 560]);
  });
  it('columna: dos laterales aplicados de la altura total, al ras de las puertas', () => {
    const c = special('COLUMNA', { width: 650, height: 2300, depth: 560 });
    expect(size(calculateModuleParts(c as any), 'Lateral aplicado columna')).toEqual([581, 2300, 2]);
    const { pieces, status } = placeModule(c);
    expect(status).toBe('placed');
    expect(pieces.map(p => [p.box.min[0], p.box.max[0], p.box.max[2]])).toEqual([[0, 18, 581], [632, 650, 581]]);
  });
  it('columna: los módulos de adentro no cuentan como superposición', () => {
    const c = { ...special('COLUMNA', { width: 649, height: 2300, depth: 560 }), layout3d: { x: 0, y: 0, z: 0, rotY: 0 } };
    const h = { ...special('HORNO_EMPOTRADO', { width: 600, height: 600, depth: 560 }), id: 'h', layout3d: { x: 18, y: 800, z: 0, rotY: 0 } };
    expect(buildAssembly('x', [c, h]).issues.filter(i => i.code === 'MODULE_OVERLAP')).toEqual([]);
  });
});
