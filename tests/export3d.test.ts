/**
 * Exportación a 3ds Max: el FBX se valida volviéndolo a leer con el FBXLoader de three.js
 * (lector independiente del exportador). No hay 3ds Max en este entorno.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { buildSpecialModules } from './fixtures/moduleMatrix.mjs';
import { SPECIAL_MODULE_TEMPLATES } from '../utils/specialModules';
import { buildAssembly, buildScene, boxCenter, rotateY, transformBox } from '../utils/furniture3d/geometry';
import { exportFBX, exportOBJ, FBX_UNIT_SCALE_FACTOR, safeName } from '../utils/furniture3d/exporters';

const BASE = {
  width: 600, height: 720, depth: 580, quantity: 1, cntDoors: 0, cntFlaps: 0, cntDrawers: 0,
  moduleType: 'MELAMINE_FULL', isWhiteStructure: false, backingType: '3MM_WHITE', edgeCategory: 'PVC_045',
  structureCore: 'AGLO', frontsCore: 'AGLO', extras: [],
};
const mod = (over: any) => ({ ...BASE, name: 'Módulo', ...over });

const assembly = buildAssembly('Cocina Pérez', [
  mod({ id: 'a', name: 'Bajo 2 puertas', cntDoors: 2, isWhiteStructure: true }),
  mod({ id: 'b', name: 'Cajonera', width: 450, cntDrawers: 3, materialColorName: 'Roble Kendal' }),
  mod({ id: 'c', name: 'Rincón', layout3d: { x: 1050, y: 0, z: 0, rotY: 90 }, cntDoors: 1 }),
]);
const parseFbx = (text: string) => new FBXLoader().parse(new TextEncoder().encode(text).buffer as ArrayBuffer, '');
// FBXLoader devuelve directamente el nodo raíz cuando la escena tiene uno solo
const topOf = (root: THREE.Object3D) => root.name.startsWith('Amoblamiento_') ? root : topOf(root);

describe('FBX', () => {
  const scene = buildScene(assembly, 0);
  const text = exportFBX(scene, { date: new Date(2026, 9, 9, 12, 0, 0) });
  const root = parseFbx(text);
  root.updateMatrixWorld(true);

  it('es FBX 7.4 ASCII en milímetros con Y arriba', () => {
    expect(text.startsWith('; FBX 7.4.0 project file')).toBe(true);
    expect(FBX_UNIT_SCALE_FACTOR).toBe(0.1);
    expect(text).toMatch(/P: "UnitScaleFactor", "double", "Number", "",0\.1/);
    expect(text).toMatch(/P: "UpAxis", "int", "Integer", "",1/);
  });

  it('jerarquía Amoblamiento → Módulo → Pieza con nombres identificables', () => {
    const top = topOf(root);
    expect(top.name).toBe('Amoblamiento_Cocina_Perez');
    expect(top.children.map(c => c.name)).toEqual(['M01_Bajo_2_puertas', 'M02_Cajonera', 'M03_Rincon']);
    const m1 = top.children[0];
    const pieceCount = assembly.modules[0].pieces.length;
    expect(m1.children.length).toBe(pieceCount);
    expect(m1.children.map(c => c.name)).toContain('M01_Bajo_2_puertas_Tapa_superior');
    expect(m1.children.some(c => /Puerta_bisagra_izq/.test(c.name))).toBe(true);
    let meshes = 0; root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBe(assembly.modules.reduce((a, m) => a + m.pieces.length, 0));
  });

  it('posición y rotación de módulos y piezas coinciden con el modelo (mm)', () => {
    const top = topOf(root);
    assembly.modules.forEach((pm, i) => {
      const node = top.children[i];
      expect(node.position.toArray()).toEqual([pm.layout.x, pm.layout.y, pm.layout.z]);
      expect(THREE.MathUtils.radToDeg(node.rotation.y)).toBeCloseTo(pm.layout.rotY, 6);
      pm.pieces.forEach((p, k) => {
        const world = new THREE.Vector3(); node.children[k].getWorldPosition(world);
        const c = rotateY(boxCenter(p.box), pm.layout.rotY);
        expect(world.x).toBeCloseTo(c[0] + pm.layout.x, 3);
        expect(world.y).toBeCloseTo(c[1] + pm.layout.y, 3);
        expect(world.z).toBeCloseTo(c[2] + pm.layout.z, 3);
      });
    });
    // escala: el volumen total leído = medidas del mueble en mm
    const bb = new THREE.Box3().setFromObject(root);
    const size = bb.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(assembly.size.w, 3);
    expect(size.y).toBeCloseTo(assembly.size.h, 3);
    expect(size.z).toBeCloseTo(assembly.size.d, 3);
  });

  it('materiales diferenciados por placa y UV presentes', () => {
    const mats = new Set<string>();
    let withUv = 0;
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      mats.add((m.material as THREE.Material).name);
      if (m.geometry.getAttribute('uv')) withUv++;
    });
    expect(mats).toEqual(new Set([
      safeName('Melamina Blanca 18mm MDP'), safeName('Melamina Color 18mm MDP'), safeName('Roble Kendal 18mm MDP'),
      safeName('Fondo Blanco 3mm'), safeName('Melamina Blanca 15mm (cajón)'),
    ]));
    expect(withUv).toBeGreaterThan(0);
  });

  it('cada pieza lleva sus datos de taller como propiedades de usuario', () => {
    expect(text).toMatch(/P: "rodenMedidas", "KString", "", "U", "600 x 580 x 18 mm"/);
    expect(text).toMatch(/P: "rodenMaterial", "KString", "", "U", "Melamina Blanca 18mm MDP"/);
  });

  it('despiece explotado exportable con la misma jerarquía', () => {
    const ex = parseFbx(exportFBX(buildScene(assembly, 0.6)));
    const top = topOf(ex);
    expect(top.name).toBe('Amoblamiento_Cocina_Perez_despiece');
    expect(top.children.length).toBe(3);
  });

  it('plantillas sin ubicación se exportan como volumen identificado', () => {
    const sp = buildSpecialModules(SPECIAL_MODULE_TEMPLATES).find(m => m.specialTemplateId === 'ESQUINERO')!;
    const t = exportFBX(buildScene(buildAssembly('x', [sp]), 0));
    const r = parseFbx(t);
    let names: string[] = []; r.traverse(o => { if ((o as THREE.Mesh).isMesh) names.push(o.name); });
    expect(names).toEqual(['M01_Bajo_mesada_esquinero_recto_Volumen_sin_despiece']);
  });
});

describe('OBJ/MTL', () => {
  it('vértices en mm en coordenadas del mueble, un objeto por pieza y materiales', () => {
    const { obj, mtl } = exportOBJ(buildScene(assembly, 0), 'cocina.mtl');
    expect(obj).toMatch(/^mtllib cocina\.mtl$/m);
    const vs = obj.split('\n').filter(l => l.startsWith('v ')).map(l => l.split(' ').slice(1).map(Number));
    const min = [0, 1, 2].map(i => Math.min(...vs.map(v => v[i])));
    const max = [0, 1, 2].map(i => Math.max(...vs.map(v => v[i])));
    expect(max.map((v, i) => v - min[i])).toEqual([assembly.size.w, assembly.size.h, assembly.size.d].map(v => expect.closeTo(v, 3)));
    expect(obj.split('\n').filter(l => l.startsWith('o ')).length).toBe(assembly.modules.reduce((a, m) => a + m.pieces.length, 0));
    expect(mtl).toMatch(/newmtl Fondo_Blanco_3mm/);
  });
});

describe('patas (cilindros) en la exportación', () => {
  const legged = buildScene(buildAssembly('Patas', [mod({ id: 'p', name: 'Bajo', baseType: 'PATAS', cntDoors: 2 })]), 0);
  it('FBX: cada pata es una malla cilíndrica de Ø 40 × 100 que el lector acepta', () => {
    const root = parseFbx(exportFBX(legged, { date: new Date(2026, 9, 13, 12, 0, 0) }));
    root.updateMatrixWorld(true);
    const legs: THREE.Mesh[] = [];
    root.traverse(o => { if ((o as THREE.Mesh).isMesh && o.name.includes('Pata_regulable')) legs.push(o as THREE.Mesh); });
    expect(legs).toHaveLength(4);
    legs.forEach(l => {
      const b = new THREE.Box3().setFromObject(l);
      const s = b.getSize(new THREE.Vector3());
      expect(s.x).toBeCloseTo(40, 3); expect(s.y).toBeCloseTo(100, 3); expect(s.z).toBeCloseTo(40, 3);
      expect(b.min.y).toBeCloseTo(0, 3);
    });
  });
  it('OBJ: las tapas de la pata son polígonos de 24 lados', () => {
    const { obj } = exportOBJ(legged);
    const block = obj.split(/^o /m).find(b => b.startsWith('M01_Bajo_Pata_regulable'))!;
    const faces = block.split('\n').filter(l => l.startsWith('f '));
    expect(faces).toHaveLength(26);   // 24 laterales + 2 tapas
    expect(faces.filter(f => f.split(' ').length === 25)).toHaveLength(2);
  });
});

describe('bandejas inclinadas en la exportación', () => {
  const bot = buildScene(buildAssembly('Botinero', [mod({ id: 'bf', name: 'Botinero', cabinetType: 'BOTINERO_FIJO', width: 800, height: 1200, depth: 350 })]), 0);
  it('FBX: la bandeja lleva Lcl Rotation de 30° en x y el lector la gira', () => {
    const root = parseFbx(exportFBX(bot, { date: new Date(2026, 9, 13, 12, 0, 0) }));
    const trays: THREE.Object3D[] = [];
    root.traverse(o => { if ((o as THREE.Mesh).isMesh && o.name.includes('Bandeja_fija_inclinada')) trays.push(o); });
    expect(trays).toHaveLength(6);
    trays.forEach(t => expect(THREE.MathUtils.radToDeg(t.rotation.x)).toBeCloseTo(30, 3));
  });
  it('OBJ: los vértices de la bandeja quedan girados (alto = L·sen30 + 18·cos30)', () => {
    const { obj } = exportOBJ(bot);
    const block = obj.split(/^o /m).find(b => b.startsWith('M01_Botinero_Bandeja_fija_inclinada'))!;
    const ys = block.split('\n').filter(l => l.startsWith('v ')).map(l => Number(l.split(' ')[2]));
    const L = 350 - 21 - 10;   // fondo 3 mm: profundidad del estante D − 31
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(L * 0.5 + 18 * Math.cos(Math.PI / 6), 3);
  });
});

describe('giros en X/Z y copias separadas en la exportación', () => {
  const rot = buildAssembly('Giros', [
    mod({ id: 'r1', name: 'Volcado', cntDoors: 1, layout3d: { x: 0, y: 0, z: 0, rotY: 90, rotX: 90, rotZ: 0 } }),
    mod({ id: 'r2', name: 'De costado', width: 720, height: 18, depth: 100, quantity: 2,
      layout3d: { x: 2000, y: 0, z: 0, rotY: 0, rotZ: 90 }, layout3dCopies: { 1: { x: 2600, y: 0, z: 0, rotY: 180, rotZ: 270 } } }),
  ]);
  const scene = buildScene(rot, 0);
  it('FBX: cada módulo, releído con FBXLoader, ocupa la misma caja que en el visor', () => {
    const root = parseFbx(exportFBX(scene));
    root.updateMatrixWorld(true);
    const top = topOf(root);
    expect(top.children.length).toBe(rot.modules.length);
    rot.modules.forEach((pm, i) => {
      const bb = new THREE.Box3().setFromObject(top.children[i]);
      // la caja de piezas puede ser menor que el volumen del módulo (frentes, fondo): se compara contra las piezas
      const expected = new THREE.Box3();
      pm.pieces.forEach(p => {
        const wb = transformBox(p.box, pm.layout);
        expected.union(new THREE.Box3(new THREE.Vector3(...wb.min), new THREE.Vector3(...wb.max)));
      });
      ['x', 'y', 'z'].forEach(k => {
        expect((bb.min as any)[k]).toBeCloseTo((expected.min as any)[k], 2);
        expect((bb.max as any)[k]).toBeCloseTo((expected.max as any)[k], 2);
      });
    });
  });
  it('OBJ: los vértices quedan dentro de la caja del mueble', () => {
    const { obj } = exportOBJ(scene, 'x.mtl');
    const vs = obj.split('\n').filter(l => l.startsWith('v ')).map(l => l.slice(2).split(' ').map(Number));
    const b = rot.bbox;
    vs.forEach(v => v.forEach((c, k) => { expect(c).toBeGreaterThanOrEqual(b.min[k] - 1e-3); expect(c).toBeLessThanOrEqual(b.max[k] + 1e-3); }));
  });
});

describe('FBX con materiales de la biblioteca', () => {
  const asm = buildAssembly('Placard', [mod({ id: 't', name: 'Bajo', cntDoors: 2, materialColorName: 'Roble Kendal' })]);
  const scene = buildScene(asm, 0);
  const materials = (label: string) => /roble kendal/i.test(label)
    ? { color: [0.7, 0.5, 0.3] as [number, number, number], gloss: 0.1, texture: { fileName: 'Roble_Kendal.jpg', widthMm: 400, heightMm: 800, grainVertical: true } }
    : null;
  const text = exportFBX(scene, { materials });
  it('referencia la imagen al lado del .fbx y la conecta al color difuso del material', () => {
    expect(text).toMatch(/Video: \d+, "Video::Roble_Kendal_18mm_MDP", "Clip"/);
    expect(text).toMatch(/RelativeFilename: "Roble_Kendal\.jpg"/);
    const tex = text.match(/Texture: (\d+), "Texture::Roble_Kendal_18mm_MDP"/)!;
    const mat = text.match(/Material: (\d+), "Material::Roble_Kendal_18mm_MDP"/)!;
    expect(text).toContain(`C: "OP",${tex[1]},${mat[1]}, "DiffuseColor"`);
    expect(text).toMatch(/ObjectType: "Texture" \{\n\t\tCount: 1/);
  });
  it('material con textura: difuso blanco; sin textura ni biblioteca: igual que antes', () => {
    const block = text.slice(text.indexOf('"Material::Roble_Kendal_18mm_MDP"'));
    expect(block.slice(0, 400)).toMatch(/"DiffuseColor", "Color", "", "A",1,1,1/);
    expect(exportFBX(scene, { date: new Date(2026, 0, 1) })).toBe(exportFBX(scene, { date: new Date(2026, 0, 1), materials: () => null }));
    expect(exportFBX(scene)).not.toMatch(/Texture::/);
  });
  it('UV a escala de la imagen: un lateral de 684 mm de alto (veta) recorre 684/800 de la imagen', () => {
    const geo = text.slice(text.indexOf('Geometry::M01_Bajo_Lateral"'));
    const uv = geo.slice(geo.indexOf('UV: *')).match(/a: ([^\n]+)/)![1].split(',').map(Number);
    const vs = uv.filter((_, i) => i % 2 === 1);
    expect(Math.max(...vs) - Math.min(...vs)).toBeCloseTo(684 / 800, 3);
  });
});

describe('material elegido en el constructor (material3d, solo dibujo)', () => {
  const base = { id: 'e', name: 'Bajo', cntDoors: 2, materialColorName: 'Roble Kendal' };
  const piecesOf = (m: any) => buildScene(buildAssembly('x', [mod(m)]), 0).modules.flatMap(sm => sm.pieces.map(sp => sp.piece));
  it('frentes toman el de frentes; el resto de 18 mm, el de estructura; 15 y 3 mm no cambian', () => {
    const ps = piecesOf({ ...base, cntDrawers: 1, cntDoors: 1, material3d: { structure: 'Blanco Nieve', fronts: 'Nogal Terracota' } });
    ps.filter(p => /^(Puerta|Frente)/.test(p.name)).forEach(p => expect(p.finish).toBe('Nogal Terracota'));
    ps.filter(p => p.name.startsWith('Lateral') && p.material.startsWith('18mm')).forEach(p => expect(p.finish).toBe('Blanco Nieve'));
    expect(ps.filter(p => p.finish === 'Blanco Nieve').length).toBeGreaterThan(2);
    ps.filter(p => /^(15mm|3mm)/.test(p.material)).forEach(p => expect(p.finish).toBeUndefined());
    expect(ps.some(p => p.material.startsWith('15mm'))).toBe(true);
  });
  it('frentes sin elegir = estructura; sin material3d, nada cambia', () => {
    piecesOf({ ...base, material3d: { structure: 'Blanco Nieve' } }).filter(p => p.material.startsWith('18mm')).forEach(p => expect(p.finish).toBe('Blanco Nieve'));
    piecesOf(base).forEach(p => expect(p.finish).toBeUndefined());
  });
  it('FBX: un material por el elegido (no por la placa), y la placa queda en las propiedades', () => {
    const scene = buildScene(buildAssembly('x', [mod({ ...base, material3d: { structure: 'Nogal Terracota' } })]), 0);
    const text = exportFBX(scene, { materials: l => (l === 'Nogal Terracota' ? { color: [0.4, 0.3, 0.2] } : null) });
    expect(text).toMatch(/"Material::Nogal_Terracota"/);
    expect(text).not.toMatch(/"Material::Roble_Kendal_18mm_MDP"/);
    expect(text).toMatch(/"rodenTerminacion", "KString", "", "U", "Nogal Terracota"/);
    expect(text).toMatch(/"rodenMaterial", "KString", "", "U", "Roble Kendal 18mm MDP"/);
  });
});
