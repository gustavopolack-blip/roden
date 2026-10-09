/**
 * Constructor 3D: reordenar módulos arrastrando (filas, corrimiento de los demás).
 */
import { describe, it, expect } from 'vitest';
import { buildAssembly, layoutRows, planReorder } from '../utils/furniture3d/geometry';

const BASE = {
  height: 720, depth: 580, quantity: 1, cntDoors: 1, cntFlaps: 0, cntDrawers: 0,
  moduleType: 'MELAMINE_FULL', isWhiteStructure: false, backingType: '3MM_WHITE', edgeCategory: 'PVC_045',
  structureCore: 'AGLO', frontsCore: 'AGLO', extras: [],
};
const m = (id: string, width: number, over: any = {}) => ({ ...BASE, id, name: id, width, ...over });
const xs = (plan: ReturnType<typeof planReorder>) =>
  Object.fromEntries([...(plan?.layouts || new Map()).entries()].map(([k, l]) => [k, l.x]));

// Bajos A(600) B(400) C(800) en fila automática; alacena E (600) colgada a 1500.
const kitchen = () => buildAssembly('Cocina', [
  m('A', 600), m('B', 400), m('C', 800),
  m('E', 600, { height: 700, depth: 350, layout3d: { x: 0, y: 1500, z: 0, rotY: 0 } }),
]);

describe('filas', () => {
  it('separa bajos y alacenas, ordenados por x', () => {
    const rows = layoutRows(kitchen());
    expect(rows.map(r => [r.y, r.members])).toEqual([[0, [0, 1, 2]], [1500, [3]]]);
  });
  it('los módulos girados no forman parte de ninguna fila', () => {
    const a = buildAssembly('L', [m('A', 600), m('W', 600, { layout3d: { x: 2000, y: 0, z: 0, rotY: 90 } })]);
    expect(layoutRows(a).flatMap(r => r.members)).toEqual([0]);
  });
});

describe('arrastrar dentro de la fila', () => {
  it('A al final: B y C se corren a la izquierda 600', () => {
    const p = planReorder(kitchen(), 0, { x: 1700, y: 300 })!;
    expect(p.changed).toBe(true);
    expect(xs(p)).toEqual({ 0: 1200, 1: 0, 2: 400 });
  });
  it('C al principio: A y B se corren a la derecha 800', () => {
    const p = planReorder(kitchen(), 2, { x: 100, y: 300 })!;
    expect(xs(p)).toEqual({ 0: 800, 1: 1400, 2: 0 });
  });
  it('soltar en su mismo lugar no cambia nada', () => {
    const p = planReorder(kitchen(), 1, { x: 800, y: 300 })!;
    expect(p.changed).toBe(false);
    expect(p.layouts.size).toBe(0);
  });
  it('conserva el hueco entre módulos (p. ej. heladera)', () => {
    // A 0–600, hueco 700, B 1300–1700, C 1700–2500
    const a = buildAssembly('Cocina', [
      m('A', 600, { layout3d: { x: 0, y: 0, z: 0, rotY: 0 } }),
      m('B', 400, { layout3d: { x: 1300, y: 0, z: 0, rotY: 0 } }),
      m('C', 800, { layout3d: { x: 1700, y: 0, z: 0, rotY: 0 } }),
    ]);
    const p = planReorder(a, 2, { x: 1400, y: 300 })!;   // C antes de B
    expect(xs(p)).toEqual({ 1: 2100, 2: 1300 });       // el hueco 600–1300 sigue
  });
  it('un módulo con cantidad 2 ocupa el doble de ancho', () => {
    const a = buildAssembly('x', [m('A', 600, { quantity: 2 }), m('B', 400)]);
    const p = planReorder(a, 1, { x: 0, y: 300 })!;
    expect(xs(p)).toEqual({ 0: 400, 1: 0 });
    const q = planReorder(a, 0, { x: 2000, y: 300 })!;
    expect(xs(q)).toEqual({ 0: 400, 1: 0 });
  });
});

describe('arrastrar a otra fila', () => {
  it('B sube a la fila de alacenas: C cierra el hueco y E se corre', () => {
    const p = planReorder(kitchen(), 1, { x: 100, y: 1800 })!;
    expect(p.rowY).toBe(1500);
    const l = p.layouts;
    expect(l.get(1)).toEqual({ x: 0, y: 1500, z: 0, rotY: 0 });
    expect(l.get(2)!.x).toBe(600);
    expect(l.get(3)!.x).toBe(400);
  });
  it('el resultado no tiene módulos superpuestos', () => {
    const mods = [
      m('A', 600), m('B', 400), m('C', 800),
      m('E', 600, { height: 700, depth: 350, layout3d: { x: 0, y: 1500, z: 0, rotY: 0 } }),
    ];
    const a = buildAssembly('Cocina', mods);
    for (const [idx, ptr] of [[0, { x: 1700, y: 300 }], [2, { x: 0, y: 300 }], [1, { x: 900, y: 1700 }], [3, { x: 500, y: 200 }]] as const) {
      const p = planReorder(a, idx, ptr)!;
      const next = mods.map((mod, i) => {
        const pm = a.modules.find(x => x.moduleIndex === i && x.instance === 0)!;
        return { ...mod, layout3d: p.layouts.get(i) || pm.layout };
      });
      expect(buildAssembly('Cocina', next).issues.filter(i => i.code === 'MODULE_OVERLAP')).toEqual([]);
    }
  });
});
