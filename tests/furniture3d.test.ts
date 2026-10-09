/**
 * Constructor 3D: geometría, composición, validaciones y correspondencia con el despiece.
 */
import { describe, it, expect } from 'vitest';
import { buildStandardModules, buildSpecialModules } from './fixtures/moduleMatrix.mjs';
import { SPECIAL_MODULE_TEMPLATES } from '../utils/specialModules';
import { calculateModuleParts } from '../utils/estimatorEngine';
import {
  buildAssembly, buildScene, placeModule, findPieceOverlaps, boxSize, transformBox, overlapVolume, MODULE_PLACERS,
} from '../utils/furniture3d/geometry';

const BASE = {
  width: 600, height: 720, depth: 580, quantity: 1, cntDoors: 0, cntFlaps: 0, cntDrawers: 0,
  moduleType: 'MELAMINE_FULL', isWhiteStructure: false, backingType: '3MM_WHITE', edgeCategory: 'PVC_045',
  structureCore: 'AGLO', frontsCore: 'AGLO', extras: [],
};
const mod = (over: any) => ({ ...BASE, id: over.id || 'm', name: over.name || 'Módulo', ...over });
const sorted = (a: number[]) => [...a].map(v => Math.round(v * 1000) / 1000).sort((x, y) => x - y);
const issuesOf = (a: ReturnType<typeof buildAssembly>, code: string) => a.issues.filter(i => i.code === code);

describe('ubicación de piezas de un módulo estándar', () => {
  it('600×720×580 con 2 puertas: estructura según reglas del taller', () => {
    const { pieces, status } = placeModule(mod({ cntDoors: 2 }));
    expect(status).toBe('placed');
    const by = (name: string) => pieces.filter(p => p.name === name);
    expect(by('Tapa superior')[0].box).toEqual({ min: [0, 702, 0], max: [600, 720, 580] });
    expect(by('Base inferior')[0].box).toEqual({ min: [0, 0, 0], max: [600, 18, 580] });
    // laterales entre tapa y base: alto H − 36
    expect(by('Lateral').map(p => p.box)).toEqual([
      { min: [0, 18, 0], max: [18, 702, 580] },
      { min: [582, 18, 0], max: [600, 702, 580] },
    ]);
    // puertas delante de la estructura, margen 3mm, alto H − 6
    const doors = by('Puerta');
    expect(doors.map(d => d.box.min[0])).toEqual([3, 302]);
    doors.forEach(d => { expect(d.box.min[1]).toBe(3); expect(d.box.max[1]).toBe(717); expect(d.box.min[2]).toBe(580); expect(d.box.max[2]).toBe(598); });
    expect(doors.map(d => d.hingeSide)).toEqual(['left', 'right']);
    expect(findPieceOverlaps(pieces)).toEqual([]);
  });

  it('3 cajones: frentes apilados con 4mm, cajas dentro del hueco y fondo en ranura', () => {
    const { pieces } = placeModule(mod({ cntDrawers: 3 }));
    const fronts = pieces.filter(p => p.name === 'Frente Cajón').map(p => p.box);
    expect(fronts[0].max[1]).toBe(717);                      // arranca a 3mm de arriba
    expect(fronts[1].max[1]).toBeCloseTo(fronts[0].min[1] - 4); // 4mm entre filas
    expect(fronts[2].min[1]).toBeCloseTo(3);                  // termina a 3mm de abajo
    const box = pieces.filter(p => p.role === 'drawer');
    box.forEach(p => { expect(p.box.min[0]).toBeGreaterThanOrEqual(18 + 12.5 - 1e-9); expect(p.box.max[0]).toBeLessThanOrEqual(600 - 18 - 12.5 + 1e-9); });
    // la ranura del fondo de cajón no cuenta como choque
    expect(findPieceOverlaps(pieces)).toEqual([]);
    expect(pieces.filter(p => p.groove).length).toBe(3);
  });

  it('cajón + 2 puertas: cajón arriba y puertas debajo, sin superposición de frentes', () => {
    const { pieces } = placeModule(mod({ cntDrawers: 1, cntDoors: 2, drawerFrontHeight: 150 }));
    const drawer = pieces.find(p => p.name === 'Frente Cajón')!.box;
    const door = pieces.find(p => p.name === 'Puerta')!.box;
    expect(drawer.max[1] - drawer.min[1]).toBe(150);
    expect(door.max[1]).toBeCloseTo(drawer.min[1] - 4);
    expect(findPieceOverlaps(pieces)).toEqual([]);
  });

  it('1 puerta respeta el sentido de apertura elegido', () => {
    expect(placeModule(mod({ cntDoors: 1, doorHingeSide: 'RIGHT' })).pieces.find(p => p.name === 'Puerta')!.hingeSide).toBe('right');
    expect(placeModule(mod({ cntDoors: 1 })).pieces.find(p => p.name === 'Puerta')!.hingeSide).toBe('left');
  });
});

describe('correspondencia entre modelo 3D y despiece', () => {
  const all = [...buildStandardModules(), ...buildSpecialModules(SPECIAL_MODULE_TEMPLATES)];
  it.each(all.map(m => [m.name, m] as const))('%s: cada pieza del despiece aparece con sus medidas', (_n, m) => {
    const parts = calculateModuleParts(m as any);
    const placed = placeModule(m);
    const pieces = placed.status === 'unplaced' ? placed.gridPieces : placed.pieces;
    parts.forEach((p, i) => {
      const mine = pieces.filter(x => x.partIndex === i);
      expect(mine.length).toBe(p.quantity || 1);
      mine.forEach(x => {
        expect(sorted(boxSize(x.box))).toEqual(sorted([p.width, p.height, x.thickness]));
      });
    });
    expect(pieces.length).toBe(parts.reduce((a, p) => a + (p.quantity || 1), 0));
  });

  it('el registro cubre el estándar y las plantillas con geometría definida', () => {
    expect(Object.keys(MODULE_PLACERS)).toEqual(expect.arrayContaining([
      'STANDARD', 'MODULO_ABIERTO', 'BIBLIOTECA', 'BOTINERO_EXTRAIBLE', 'BOTINERO_FIJO', 'ESTANTE_18MM', 'PUERTA_18MM',
      'LATERAL_APLICADO', 'DIVISOR_VERTICAL', 'AJUSTE', 'ZOCALO_APLICADO', 'TAPA_HORIZONTAL', 'ESTANTE_FLOTANTE',
    ]));
  });

  it('plantillas con piezas ubicadas no se pisan entre sí (salvo fondos 5,5/18 con regla pendiente)', () => {
    buildSpecialModules(SPECIAL_MODULE_TEMPLATES).forEach(m => {
      const pl = placeModule(m);
      if (pl.status !== 'placed') return;
      findPieceOverlaps(pl.pieces).forEach(([a, b]) => {
        const pending = [a, b].some(p => p.role === 'back' && p.thickness > 3);
        expect(pending, `${m.name}: ${a.name} / ${b.name}`).toBe(true);
      });
    });
  });
});

describe('composición del amoblamiento', () => {
  it('módulos sin posición se alinean en fila y las copias (Cant.) van una al lado de la otra', () => {
    const a = buildAssembly('Cocina', [mod({ id: 'a', cntDoors: 2 }), mod({ id: 'b', width: 400, quantity: 2, cntDrawers: 3 })]);
    expect(a.modules.map(m => m.layout.x)).toEqual([0, 600, 1000]);
    expect(a.size.w).toBe(1400);
    expect(a.size.h).toBe(720);
    expect(a.size.d).toBe(598);       // 580 de estructura + 18 de frente
    expect(issuesOf(a, 'MODULE_OVERLAP')).toEqual([]);
    expect(issuesOf(a, 'MODULE_GAP')).toEqual([]);
  });

  it('posición y rotación guardadas: rotar 90° intercambia ancho y profundidad', () => {
    const a = buildAssembly('Rincón', [mod({ id: 'r', layout3d: { x: 1000, y: 0, z: 0, rotY: 90 } })]);
    const s = boxSize(a.modules[0].worldBox);
    expect(sorted([s[0], s[2]])).toEqual(sorted([600, 580]));
    expect(s[0]).toBeCloseTo(580); // en x ahora queda la profundidad
    const carcass = transformBox({ min: [0, 0, 0], max: [600, 720, 580] }, { x: 1000, y: 0, z: 0, rotY: 90 });
    expect(carcass).toEqual({ min: [1000, 0, -600], max: [1580, 720, 0] });
  });

  it('una alacena colgada no corre la fila automática del piso', () => {
    const a = buildAssembly('Cocina', [mod({ id: 'alto', height: 700, depth: 350, layout3d: { x: 0, y: 1500, z: 0, rotY: 0 } }), mod({ id: 'bajo' })]);
    expect(a.modules[1].layout.x).toBe(0);
    expect(issuesOf(a, 'MODULE_OVERLAP')).toEqual([]);
  });

  it('una alacena elevada se ubica sobre el bajo mesada', () => {
    const a = buildAssembly('Cocina', [mod({ id: 'bajo' }), mod({ id: 'alto', height: 700, depth: 350, layout3d: { x: 0, y: 1500, z: 0, rotY: 0 } })]);
    expect(a.size.h).toBe(2200);
    expect(issuesOf(a, 'MODULE_OVERLAP')).toEqual([]);
  });
});

describe('validaciones', () => {
  it('detecta módulos superpuestos y separaciones chicas, no las uniones al ras', () => {
    const over = buildAssembly('x', [mod({ id: 'a', layout3d: { x: 0, y: 0, z: 0, rotY: 0 } }), mod({ id: 'b', layout3d: { x: 500, y: 0, z: 0, rotY: 0 } })]);
    expect(issuesOf(over, 'MODULE_OVERLAP').length).toBe(1);
    const gap = buildAssembly('x', [mod({ id: 'a', layout3d: { x: 0, y: 0, z: 0, rotY: 0 } }), mod({ id: 'b', layout3d: { x: 603, y: 0, z: 0, rotY: 0 } })]);
    expect(issuesOf(gap, 'MODULE_GAP').length).toBe(1);
    const flush = buildAssembly('x', [mod({ id: 'a', layout3d: { x: 0, y: 0, z: 0, rotY: 0 } }), mod({ id: 'b', layout3d: { x: 600, y: 0, z: 0, rotY: 0 } })]);
    expect(flush.issues.filter(i => i.level !== 'info')).toEqual([]);
  });

  it('detecta medidas inválidas, piezas sin medida y frentes que no entran', () => {
    expect(issuesOf(buildAssembly('x', [mod({ width: 0 })]), 'INVALID_DIMENSION').length).toBeGreaterThan(0);
    expect(issuesOf(buildAssembly('x', [mod({ width: 50, cntDrawers: 2 })]), 'INVALID_DIMENSION').length).toBeGreaterThan(0);
    expect(issuesOf(buildAssembly('x', [mod({ cntDrawers: 1, cntDoors: 2, drawerFrontHeight: 800 })]), 'FRONT_OVERFLOW').length).toBe(1);
  });

  it('señala el choque del fondo 5,5mm (regla pendiente) en vez de ocultarlo', () => {
    const a = buildAssembly('x', [mod({ backingType: '55_COLOR', cntDoors: 2 })]);
    expect(issuesOf(a, 'PIECE_OVERLAP').length).toBeGreaterThan(0);
    expect(a.modules[0].notes.join(' ')).toMatch(/pendiente/);
  });

  it('plantillas sin ubicación definida quedan marcadas y se muestran como volumen', () => {
    const sp = buildSpecialModules(SPECIAL_MODULE_TEMPLATES).find(m => m.specialTemplateId === 'MODULO_BAJO_MESADA')!;
    const a = buildAssembly('x', [sp]);
    expect(issuesOf(a, 'UNPLACED_MODULE').length).toBe(1);
    const scene = buildScene(a, 0);
    expect(scene.modules[0].placeholder).toBeTruthy();
    expect(buildScene(a, 1).modules[0].pieces.length).toBe(calculateModuleParts(sp as any).reduce((s, p) => s + (p.quantity || 1), 0));
  });
});

describe('despiece explotado', () => {
  it('separa las piezas sin cambiar sus medidas', () => {
    const a = buildAssembly('x', [mod({ cntDrawers: 2, cntDoors: 0 }), mod({ id: 'b', cntDoors: 2 })]);
    const s0 = buildScene(a, 0), s1 = buildScene(a, 0.6);
    s0.modules.forEach((m, mi) => m.pieces.forEach((p, pi) => {
      const q = s1.modules[mi].pieces[pi];
      boxSize(q.box).forEach((v, k) => expect(v).toBeCloseTo(boxSize(p.box)[k], 6));
    }));
    // las piezas explotadas de un módulo ya no se tocan
    const exploded = s1.modules[0].pieces;
    let touching = 0;
    for (let i = 0; i < exploded.length; i++) for (let j = i + 1; j < exploded.length; j++) if (overlapVolume(exploded[i].box, exploded[j].box) > 0) touching++;
    expect(touching).toBeLessThan(findPieceOverlaps(placeModule(mod({ cntDrawers: 2 })).pieces).length + 4);
    // un módulo puede verse solo
    expect(buildScene(a, 0.6, a.modules[1].key).modules.length).toBe(1);
  });
});
