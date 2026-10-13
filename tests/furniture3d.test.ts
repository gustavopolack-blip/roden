/**
 * Constructor 3D: geometría, composición, validaciones y correspondencia con el despiece.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildStandardModules, buildSpecialModules } from './fixtures/moduleMatrix.mjs';
import { SPECIAL_MODULE_TEMPLATES } from '../utils/specialModules';
import { calculateModuleParts } from '../utils/estimatorEngine';
import {
  buildAssembly, buildScene, placeModule, findPieceOverlaps, boxSize, boxCenter, transformBox, overlapVolume, MODULE_PLACERS,
  fitCameraDistance,
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
    // puertas separadas 3 mm de la caja, 2 mm al borde, 4 mm entre puertas, alto H − 4
    const doors = by('Puerta');
    expect(doors.map(d => d.box.min[0])).toEqual([2, 302]);
    doors.forEach(d => { expect(d.box.min[1]).toBe(2); expect(d.box.max[1]).toBe(718); expect(d.box.min[2]).toBe(583); expect(d.box.max[2]).toBe(601); });
    // fondo 3 mm en ranura a 18 mm de atrás
    expect(by('Fondo 3mm Blanco')[0].box).toEqual({ min: [14, 14, 18], max: [586, 706, 21] });
    expect(doors.map(d => d.hingeSide)).toEqual(['left', 'right']);
    expect(findPieceOverlaps(pieces)).toEqual([]);
  });

  it('3 cajones: frentes apilados con 4mm, cajas dentro del hueco y fondo en ranura', () => {
    const { pieces } = placeModule(mod({ cntDrawers: 3 }));
    const fronts = pieces.filter(p => p.name === 'Frente Cajón').map(p => p.box);
    expect(fronts[0].max[1]).toBe(718);                      // arranca a 2mm de arriba
    expect(fronts[1].max[1]).toBeCloseTo(fronts[0].min[1] - 4); // 4mm entre filas
    expect(fronts[2].min[1]).toBeCloseTo(2);                  // termina a 2mm de abajo
    const box = pieces.filter(p => p.role === 'drawer');
    box.forEach(p => { expect(p.box.min[0]).toBeGreaterThanOrEqual(18 + 12.5 - 1e-9); expect(p.box.max[0]).toBeLessThanOrEqual(600 - 18 - 12.5 + 1e-9); });
    // la ranura del fondo de cajón no cuenta como choque
    expect(findPieceOverlaps(pieces)).toEqual([]);
    expect(pieces.filter(p => p.groove).length).toBe(4);      // 3 fondos de cajón + fondo 3 mm del módulo
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
    expect(a.size.d).toBe(601);       // 580 de estructura + 3 de separación + 18 de frente
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

  it('fondos de 5,5 mm (rebaje) y 18 mm (dentro de la caja) sin choques', () => {
    const f55 = placeModule(mod({ backingType: '55_COLOR', cntDoors: 2 })).pieces;
    expect(f55.find(p => p.name === 'Fondo 5.5mm Color')!.box).toEqual({ min: [5, 5, 0], max: [595, 715, 5.5] });
    expect(findPieceOverlaps(f55)).toEqual([]);
    const f18 = placeModule(mod({ backingType: '18MM_STRUCTURE', cntDoors: 2 })).pieces;
    expect(f18.find(p => p.name === 'Fondo Estructural 18mm')!.box).toEqual({ min: [18, 18, 0], max: [582, 702, 18] });
    expect(findPieceOverlaps(f18)).toEqual([]);
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

describe('encuadre de cámara del visor', () => {
  // Los 8 vértices tienen que proyectarse dentro de la pantalla (NDC en [-1, 1]) con la misma
  // dirección de cámara que usa el visor, también en visores angostos o apaisados.
  const corners = (b: { min: number[]; max: number[] }) => {
    const out: THREE.Vector3[] = [];
    for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) out.push(new THREE.Vector3(x, y, z));
    return out;
  };
  const cases = [
    { name: 'módulo 600×720×580', box: { min: [0, 0, 0], max: [600, 720, 580] } },
    { name: 'placard 4200×2600×600', box: { min: [0, 0, 0], max: [4200, 2600, 600] } },
    { name: 'estante 2400×18×250', box: { min: [-1200, 900, 0], max: [1200, 918, 250] } },
  ];
  for (const { name, box } of cases) {
    for (const aspect of [0.45, 1, 2.4]) {
      it(`${name} entra completo con proporción ${aspect}`, () => {
        const camera = new THREE.PerspectiveCamera(40, aspect, 1, 1e6);
        const center = new THREE.Vector3(...boxCenter(box as any));
        const dist = fitCameraDistance(box as any, camera.fov, aspect);
        camera.position.copy(center).addScaledVector(new THREE.Vector3(0.7, 0.55, 1.5).normalize(), dist);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        for (const c of corners(box)) {
          const p = c.clone().project(camera);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
        }
      });
    }
  }
});

describe('ficha constructiva del módulo estándar en 3D', () => {
  const by = (pieces: any[], name: string) => pieces.filter(p => p.name === name);
  it('laterales enteros: laterales de piso a techo, tapa y base entre laterales', () => {
    const { pieces } = placeModule(mod({ fullHeightSides: true, cntDoors: 2 }));
    expect(by(pieces, 'Lateral').map(p => p.box)).toEqual([
      { min: [0, 0, 0], max: [18, 720, 580] },
      { min: [582, 0, 0], max: [600, 720, 580] },
    ]);
    expect(by(pieces, 'Tapa superior')[0].box).toEqual({ min: [18, 702, 0], max: [582, 720, 580] });
    expect(findPieceOverlaps(pieces)).toEqual([]);
  });
  it('frentes embutidos: dentro de la caja con 4 mm de luz y al ras (profundidad total D)', () => {
    const { pieces } = placeModule(mod({ insetFronts: true, cntDoors: 2, height: 2000 }));
    const doors = by(pieces, 'Puerta');
    expect(doors.map(d => d.box.min[0])).toEqual([22, 302]);
    doors.forEach(d => { expect(d.box.min[2]).toBe(562); expect(d.box.max[2]).toBe(580); expect(d.box.max[1]).toBe(1978); });
    expect(findPieceOverlaps(pieces)).toEqual([]);   // estantes 18 mm más cortos: no chocan con las puertas
    const a = buildAssembly('x', [mod({ insetFronts: true, cntDoors: 2 })]);
    expect(a.size.d).toBe(580);
  });
  it('estante a 10 mm del frente según el fondo', () => {
    const z = (backingType: string) => {
      const sh = by(placeModule(mod({ backingType, height: 1200 })).pieces, 'Estante Interno')[0].box;
      return [sh.min[2], sh.max[2]];
    };
    expect(z('3MM_WHITE')).toEqual([21, 570]);
    expect(z('55_COLOR')).toEqual([5.5, 570]);
    expect(z('18MM_STRUCTURE')).toEqual([18, 570]);
    expect(z('NONE')).toEqual([0, 570]);
  });
  it('apertura: 3 puertas izquierda/derecha/derecha; 4 en pares', () => {
    const h = (n: number) => by(placeModule(mod({ cntDoors: n, width: 1200 })).pieces, 'Puerta').map(p => p.hingeSide);
    expect(h(3)).toEqual(['left', 'right', 'right']);
    expect(h(4)).toEqual(['left', 'right', 'left', 'right']);
  });
  it('1 puerta sin lado elegido: abre hacia el lado del eje del mueble en que está el módulo', () => {
    const a = buildAssembly('x', [mod({ id: 'i', cntDoors: 1 }), mod({ id: 'c', cntDoors: 2 }), mod({ id: 'd', cntDoors: 1 })]);
    const side = (k: number) => a.modules[k].pieces.find(p => p.hingeSide)!.hingeSide;
    expect(side(0)).toBe('left');
    expect(side(2)).toBe('right');
    const elegido = buildAssembly('x', [mod({ id: 'i', cntDoors: 1, doorHingeSide: 'RIGHT' }), mod({ id: 'c', cntDoors: 2 })]);
    expect(elegido.modules[0].pieces.find(p => p.hingeSide)!.hingeSide).toBe('right');
  });
  it('patas: el módulo se eleva 120 mm y el alto total es H + 120', () => {
    const a = buildAssembly('x', [mod({ hasLegs: true, cntDoors: 2 })]);
    expect(a.size.h).toBe(840);
    expect(Math.min(...a.modules[0].pieces.map(p => p.box.min[1]))).toBe(120);
  });
  it('caja de cajón: alto según el frente y detrás del frente embutido', () => {
    const lat = (over: any) => placeModule(mod({ cntDrawers: 1, ...over })).pieces.filter(p => p.name === 'Lateral Cajón')[0].box;
    const l = lat({ height: 300 });
    expect(l.max[1] - l.min[1]).toBe(200);                 // frente de 296 → caja de 200
    const e = lat({ height: 300, insetFronts: true });
    expect(e.max[2]).toBe(562);                             // termina donde empieza el frente embutido
  });
});
