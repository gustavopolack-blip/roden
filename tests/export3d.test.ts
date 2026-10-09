/**
 * Exportación a 3ds Max: el FBX se valida volviéndolo a leer con el FBXLoader de three.js
 * (lector independiente del exportador). No hay 3ds Max en este entorno.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { buildSpecialModules } from './fixtures/moduleMatrix.mjs';
import { SPECIAL_MODULE_TEMPLATES } from '../utils/specialModules';
import { buildAssembly, buildScene, boxCenter, rotateY } from '../utils/furniture3d/geometry';
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
    expect(names).toEqual(['M01_Esquinero_Volumen_sin_despiece']);
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
