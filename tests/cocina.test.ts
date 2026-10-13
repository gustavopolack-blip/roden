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

describe('repreguntas de cocina (13/10)', () => {
  const ala = (over: any = {}) => mod({ cabinetType: 'ALACENA', width: 600, height: 700, depth: 320, cntDoors: 2, ...over });
  const shelves = (h: number) => (calculateModuleParts(ala({ height: h }) as any).find(p => p.name === 'Estante Interno')?.quantity || 0);
  it('alacena: 1 estante hasta 600 mm de alto, 2 hasta 900, 3 si es más alta', () => {
    expect([shelves(600), shelves(700), shelves(900), shelves(901), shelves(1200)]).toEqual([1, 2, 2, 3, 3]);
  });
  it('módulo microondas de alacena: abierto, fondo 18 mm, piso de 420 que sobresale 100 mm', () => {
    const p = calculateModuleParts(ala({ microwaveFloor: true, cntFlaps: 1 }) as any);
    expect(p.some(x => /^(Puerta|Frente)/.test(x.name))).toBe(false);
    expect(size(p, 'Fondo Estructural 18mm')).toEqual([564, 664, 1]);
    expect(p.some(x => x.name === 'Faja trasera' || x.name === 'Estante Interno')).toBe(false);
    const { pieces } = placeModule(ala({ microwaveFloor: true }));
    expect(pieces.find(x => x.name === 'Base inferior')!.box.max[2]).toBe(420);
    expect(findPieceOverlaps(pieces)).toEqual([]);
  });
  it('microondas de empotrar (columna): 613 × 403, sin fondo', () => {
    const m = special('MICROONDAS_COLUMNA', { width: 600, height: 400, depth: 560 });
    expect([m.width, m.height]).toEqual([613, 403]);
    const p = calculateModuleParts(m as any);
    expect(size(p, 'Lateral')).toEqual([560, 367, 2]);
    expect(p.some(x => /^Fondo/.test(x.name))).toBe(false);
    expect(placeModule(m).status).toBe('placed');
  });
  it('cajón interno: solo la caja de 80 mm, con sus guías y sin frente', () => {
    const m = mod({ width: 600, height: 720, depth: 580, cntDoors: 2, internalDrawers: 2 });
    const p = calculateModuleParts(m as any);
    expect(size(p, 'Lateral cajón interno')).toEqual([560, 80, 4]);
    expect(size(p, 'Contra/Frente cajón interno')).toEqual([509, 80, 4]);
    expect(p.some(x => x.name === 'Frente Cajón')).toBe(false);
    expect(calculateItemQuantities([m as any]).totalSlides).toBe(2);
    const { pieces } = placeModule(m);
    expect(pieces.filter(x => x.name === 'Lateral cajón interno').length).toBe(4);
    expect(findPieceOverlaps(pieces)).toEqual([]);
  });
});

describe('bajo mesada para horno', () => {
  const bh = (over: any = {}) => mod({ cabinetType: 'BAJO_HORNO', width: 800, height: 740, depth: 560, cntDoors: 2, ...over });
  it('613 de ancho (595 entre ejes), sin fondo ni puertas, estante de apoyo y faja inferior de frente', () => {
    const p = calculateModuleParts(bh() as any);
    expect(size(p, 'Lateral')).toEqual([560, 740, 2]);
    expect(size(p, 'Piso')).toEqual([577, 560, 1]);
    expect(size(p, 'Estante apoyo horno')).toEqual([577, 550, 1]);
    expect(size(p, 'Frente faja inferior horno')).toEqual([609, 136, 1]);
    expect(p.some(x => /^(Fondo|Puerta)/.test(x.name))).toBe(false);
  });
  it('3D: estante con 600 mm libres hasta arriba, faja al frente, sin choques', () => {
    const a = buildAssembly('x', [bh()]);
    expect(a.size.w).toBe(613);
    const pieces = a.modules[0].pieces;
    expect(pieces.find(x => x.name === 'Estante apoyo horno')!.box.max[1]).toBe(140);
    expect(pieces.find(x => x.name === 'Frente faja inferior horno')!.box).toEqual({ min: [2, 2, 563], max: [611, 138, 581] });
    expect(findPieceOverlaps(pieces)).toEqual([]);
  });
});

describe('bajo mesada esquinero en L', () => {
  const L = () => {
    const tpl = getTemplate('ESQUINERO_EN_L')!;
    const opts = { largo2: '1000', prof2: '560' };
    const r = tpl.calculate({ width: 1200, height: 740, depth: 560 }, opts);
    return mod({ id: 'L', width: 1200, height: 740, depth: 560, moduleType: 'SPECIAL', isSpecialModule: true, specialTemplateId: 'ESQUINERO_EN_L',
      specialOptions: opts, specialParts: r.parts, specialHardware: r.hardware });
  };
  it('despiece: columna de rincón 80 × 80, piso y estante en dos rectángulos, dos puertas', () => {
    const p = calculateModuleParts(L() as any);
    expect(size(p, 'Piso brazo 1')).toEqual([1182, 560, 1]);
    expect(size(p, 'Piso brazo 2')).toEqual([422, 560, 1]);
    expect(size(p, 'Faja columna rincón 80')).toEqual([80, 722, 1]);
    expect(size(p, 'Faja columna rincón 62')).toEqual([62, 722, 1]);
    expect(size(p, 'Puerta brazo 1')).toEqual([615, 736, 1]);
    expect(size(p, 'Puerta brazo 2')).toEqual([415, 736, 1]);
    expect(calculateItemQuantities([L() as any]).totalHinges).toBe(4);
  });
  it('3D: todas las piezas ubicadas, sin choques', () => {
    const { pieces, status } = placeModule(L());
    expect(status).toBe('placed');
    expect(findPieceOverlaps(pieces)).toEqual([]);
    const a = buildAssembly('x', [L()]);
    expect([a.size.w, a.size.d]).toEqual([1200, 1000]);
  });
});
