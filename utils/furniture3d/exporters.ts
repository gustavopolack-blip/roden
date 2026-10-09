/**
 * rødën OS — Constructor 3D: exportación FBX (ASCII 7.4) y OBJ/MTL
 *
 * FBX es el formato principal para 3ds Max: conserva jerarquía (Amoblamiento → Módulo → Pieza),
 * nombres, materiales, UV y la posición/orientación de cada módulo.
 * Unidades: la geometría se escribe en MILÍMETROS y GlobalSettings.UnitScaleFactor = 0.1
 * (FBX expresa la unidad en centímetros: 1 mm = 0.1 cm). Ejes: Y arriba (el importador de
 * 3ds Max convierte a Z arriba).
 *
 * No se genera un .max nativo: 3ds Max importa el .fbx (File → Import).
 * Se escribe FBX ASCII propio porque three.js no trae exportador FBX y no hace falta una
 * dependencia extra para cajas con materiales.
 */
import { FurnitureScene, Box, Vec3, boxCenter, boxSize, rotateY, Piece3D } from './geometry';

// ─────────────────────────────────────────────────────────────
// Materiales de presentación (colores de referencia para el render;
// en 3ds Max se reemplazan por los materiales reales)
// ─────────────────────────────────────────────────────────────
export const materialColorFor = (label: string): [number, number, number] => {
  const l = label.toLowerCase();
  if (l.includes('fondo blanco')) return [0.86, 0.86, 0.84];
  if (l.includes('fondo color')) return [0.55, 0.47, 0.38];
  if (l.includes('15mm')) return [0.94, 0.94, 0.92];
  if (l.includes('crudo')) return [0.78, 0.7, 0.58];
  if (l.includes('kiri')) return [0.76, 0.6, 0.42];
  if (l.includes('blanc')) return [0.96, 0.96, 0.95];
  if (l.includes('volumen')) return [0.7, 0.75, 0.85];
  // color de melamina: tono estable derivado del nombre
  let h = 0;
  for (let i = 0; i < l.length; i++) h = (h * 31 + l.charCodeAt(i)) >>> 0;
  const t = (h % 1000) / 1000;
  return [0.45 + 0.25 * t, 0.35 + 0.2 * t, 0.25 + 0.15 * t];
};

/** Nombre seguro para FBX/OBJ/3ds Max: sin acentos ni caracteres especiales. */
export const safeName = (s: string): string =>
  (s || 'sin_nombre')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/×/g, 'x').replace(/ø/gi, 'o').replace(/ë/gi, 'e').replace(/\./g, '_')
    .replace(/[^A-Za-z0-9_.\- ]+/g, ' ')
    .trim().replace(/\s+/g, '_') || 'sin_nombre';

const n = (v: number) => { const r = Math.round(v * 10000) / 10000; return Object.is(r, -0) ? '0' : String(r); };

// ─────────────────────────────────────────────────────────────
// Malla de caja: 6 caras × 4 vértices (normales y UV por cara)
// ─────────────────────────────────────────────────────────────
// [normal, eje u, eje v] con u × v = normal (caras antihorarias vistas desde afuera)
const FACES: [Vec3, Vec3, Vec3][] = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
  [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
  [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
];
const axisOf = (v: Vec3) => (v[0] !== 0 ? 0 : v[1] !== 0 ? 1 : 2);

export interface BoxMesh { positions: Vec3[]; normals: Vec3[]; uvs: [number, number][]; quads: [number, number, number, number][] }

/** Caja centrada en el origen, tamaño `size` (mm). UV en metros, U siguiendo la veta. */
export const boxMesh = (size: Vec3, grainAxis: 0 | 1 | 2 = 0): BoxMesh => {
  const h: Vec3 = [size[0] / 2, size[1] / 2, size[2] / 2];
  const positions: Vec3[] = [], normals: Vec3[] = [], uvs: [number, number][] = [], quads: [number, number, number, number][] = [];
  FACES.forEach(([nv, u, v]) => {
    const na = axisOf(nv), ua = axisOf(u), va = axisOf(v);
    const base = positions.length;
    ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).forEach(([su, sv]) => {
      const p: Vec3 = [0, 0, 0];
      p[na] = nv[na] * h[na];
      p[ua] += su * u[ua] * h[ua];
      p[va] += sv * v[va] * h[va];
      positions.push(p);
      normals.push(nv);
      const cu = (p[ua] + h[ua]) / 1000, cv = (p[va] + h[va]) / 1000;
      uvs.push(grainAxis === va ? [cv, cu] : [cu, cv]);
    });
    quads.push([base, base + 1, base + 2, base + 3]);
  });
  return { positions, normals, uvs, quads };
};

// ─────────────────────────────────────────────────────────────
// Nodos comunes de la escena (los usan FBX y OBJ)
// ─────────────────────────────────────────────────────────────
interface MeshNode { name: string; material: string; translation: Vec3; size: Vec3; grainAxis: 0 | 1 | 2; props: Record<string, string> }
interface ModuleNode { name: string; translation: Vec3; rotY: number; meshes: MeshNode[] }

const pieceProps = (p: Piece3D): Record<string, string> => ({
  rodenPieza: p.name,
  rodenMaterial: p.boardLabel,
  rodenMedidas: `${Math.round(p.partSize.width)} x ${Math.round(p.partSize.height)} x ${p.thickness} mm`,
  rodenVeta: p.grain,
  ...(p.hingeSide ? { rodenBisagra: p.hingeSide === 'left' ? 'izquierda' : 'derecha' } : {}),
});

const collectNodes = (scene: FurnitureScene): ModuleNode[] => {
  const used = new Set<string>();
  const unique = (s: string) => { let x = s, i = 2; while (used.has(x)) x = `${s}_${i++}`; used.add(x); return x; };
  return scene.modules.map((sm, mi) => {
    const mName = unique(safeName(`M${String(mi + 1).padStart(2, '0')}_${sm.module.name}`));
    const meshes: MeshNode[] = sm.pieces.map(sp => ({
      name: unique(safeName(`${mName}_${sp.piece.name}${sp.piece.hingeSide ? `_bisagra_${sp.piece.hingeSide === 'left' ? 'izq' : 'der'}` : ''}`)),
      material: safeName(sp.piece.boardLabel),
      translation: boxCenter(sp.box), size: boxSize(sp.box), grainAxis: sp.piece.grainAxis,
      props: pieceProps(sp.piece),
    }));
    if (sm.placeholder) {
      meshes.push({ name: unique(safeName(`${mName}_Volumen_sin_despiece`)), material: 'Volumen_pendiente',
        translation: boxCenter(sm.placeholder), size: boxSize(sm.placeholder), grainAxis: 0,
        props: { rodenNota: 'Ubicacion de piezas pendiente para esta plantilla' } });
    }
    return { name: mName, translation: [sm.layout.x, sm.layout.y, sm.layout.z], rotY: sm.layout.rotY, meshes };
  });
};

// ─────────────────────────────────────────────────────────────
// FBX ASCII 7.4
// ─────────────────────────────────────────────────────────────
export const FBX_UNIT_SCALE_FACTOR = 0.1; // cm por unidad → la unidad es el milímetro

export const exportFBX = (scene: FurnitureScene, opts: { date?: Date } = {}): string => {
  const date = opts.date || new Date();
  const modules = collectNodes(scene);
  let nextId = 100000;
  const id = () => nextId++;
  const objects: string[] = [];
  const connections: string[] = [];
  const counts = { model: 0, geometry: 0, material: 0, attr: 0 };
  const rootName = safeName(`Amoblamiento_${scene.name}${scene.exploded ? '_despiece' : ''}`);

  const props70 = (lines: string[]) => `\t\tProperties70:  {\n${lines.map(l => `\t\t\t${l}`).join('\n')}\n\t\t}`;
  const userProps = (p: Record<string, string>) =>
    Object.entries(p).map(([k, v]) => `P: "${k}", "KString", "", "U", "${safeName(v).replace(/_/g, ' ')}"`);

  const nullModel = (mid: number, name: string, t: Vec3, rotY: number) => {
    const aid = id();
    counts.model++; counts.attr++;
    objects.push(`\tNodeAttribute: ${aid}, "NodeAttribute::", "Null" {\n\t\tTypeFlags: "Null"\n\t}`);
    objects.push(`\tModel: ${mid}, "Model::${name}", "Null" {\n\t\tVersion: 232\n${props70([
      `P: "Lcl Translation", "Lcl Translation", "", "A",${n(t[0])},${n(t[1])},${n(t[2])}`,
      `P: "Lcl Rotation", "Lcl Rotation", "", "A",0,${n(rotY)},0`,
    ])}\n\t\tShading: Y\n\t\tCulling: "CullingOff"\n\t}`);
    connections.push(`\tC: "OO",${aid},${mid}`);
  };

  // Materiales (uno por etiqueta de placa)
  const materialIds = new Map<string, number>();
  const materialLabel = new Map<string, string>();
  scene.modules.forEach(sm => sm.pieces.forEach(sp => materialLabel.set(safeName(sp.piece.boardLabel), sp.piece.boardLabel)));
  if (scene.modules.some(sm => sm.placeholder)) materialLabel.set('Volumen_pendiente', 'Volumen pendiente');
  materialLabel.forEach((label, name) => {
    const mid = id(); counts.material++;
    materialIds.set(name, mid);
    const [r, g, b] = materialColorFor(label);
    objects.push(`\tMaterial: ${mid}, "Material::${name}", "" {\n\t\tVersion: 102\n\t\tShadingModel: "phong"\n\t\tMultiLayer: 0\n${props70([
      `P: "DiffuseColor", "Color", "", "A",${n(r)},${n(g)},${n(b)}`,
      `P: "Diffuse", "Vector3D", "Vector", "",${n(r)},${n(g)},${n(b)}`,
      `P: "SpecularColor", "Color", "", "A",0.1,0.1,0.1`,
      `P: "Shininess", "double", "Number", "",8`,
    ])}\n\t}`);
  });

  // Raíz → módulos → piezas
  const rootId = id();
  nullModel(rootId, rootName, [0, 0, 0], 0);
  connections.push(`\tC: "OO",${rootId},0`);

  modules.forEach(m => {
    const mid = id();
    nullModel(mid, m.name, m.translation, m.rotY);
    connections.push(`\tC: "OO",${mid},${rootId}`);
    m.meshes.forEach(mesh => {
      const gid = id(), oid = id();
      counts.geometry++; counts.model++;
      const bm = boxMesh(mesh.size, mesh.grainAxis);
      const verts = bm.positions.flat().map(n).join(',');
      const idx = bm.quads.map(q => `${q[0]},${q[1]},${q[2]},${-q[3] - 1}`).join(',');
      const norms = bm.quads.flatMap(q => q.map(i => bm.normals[i])).flat().map(n).join(',');
      const uvs = bm.uvs.flat().map(n).join(',');
      const uvIdx = bm.quads.flat().join(',');
      objects.push(`\tGeometry: ${gid}, "Geometry::${mesh.name}", "Mesh" {
\t\tVertices: *${bm.positions.length * 3} {
\t\t\ta: ${verts}
\t\t}
\t\tPolygonVertexIndex: *${bm.quads.length * 4} {
\t\t\ta: ${idx}
\t\t}
\t\tGeometryVersion: 124
\t\tLayerElementNormal: 0 {
\t\t\tVersion: 101
\t\t\tName: ""
\t\t\tMappingInformationType: "ByPolygonVertex"
\t\t\tReferenceInformationType: "Direct"
\t\t\tNormals: *${bm.quads.length * 12} {
\t\t\t\ta: ${norms}
\t\t\t}
\t\t}
\t\tLayerElementUV: 0 {
\t\t\tVersion: 101
\t\t\tName: "UVMap"
\t\t\tMappingInformationType: "ByPolygonVertex"
\t\t\tReferenceInformationType: "IndexToDirect"
\t\t\tUV: *${bm.uvs.length * 2} {
\t\t\t\ta: ${uvs}
\t\t\t}
\t\t\tUVIndex: *${bm.quads.length * 4} {
\t\t\t\ta: ${uvIdx}
\t\t\t}
\t\t}
\t\tLayerElementMaterial: 0 {
\t\t\tVersion: 101
\t\t\tName: ""
\t\t\tMappingInformationType: "AllSame"
\t\t\tReferenceInformationType: "IndexToDirect"
\t\t\tMaterials: *1 {
\t\t\t\ta: 0
\t\t\t}
\t\t}
\t\tLayer: 0 {
\t\t\tVersion: 100
\t\t\tLayerElement:  {
\t\t\t\tType: "LayerElementNormal"
\t\t\t\tTypedIndex: 0
\t\t\t}
\t\t\tLayerElement:  {
\t\t\t\tType: "LayerElementUV"
\t\t\t\tTypedIndex: 0
\t\t\t}
\t\t\tLayerElement:  {
\t\t\t\tType: "LayerElementMaterial"
\t\t\t\tTypedIndex: 0
\t\t\t}
\t\t}
\t}`);
      objects.push(`\tModel: ${oid}, "Model::${mesh.name}", "Mesh" {\n\t\tVersion: 232\n${props70([
        `P: "Lcl Translation", "Lcl Translation", "", "A",${n(mesh.translation[0])},${n(mesh.translation[1])},${n(mesh.translation[2])}`,
        ...userProps(mesh.props),
      ])}\n\t\tShading: T\n\t\tCulling: "CullingOff"\n\t}`);
      connections.push(`\tC: "OO",${oid},${mid}`);
      connections.push(`\tC: "OO",${gid},${oid}`);
      connections.push(`\tC: "OO",${materialIds.get(mesh.material)},${oid}`);
    });
  });

  const ts = date;
  const total = counts.model + counts.geometry + counts.material + counts.attr + 1;
  return `; FBX 7.4.0 project file
; ----------------------------------------------------
; rodenOS - Constructor 3D. Unidades: milimetros (UnitScaleFactor 0.1 cm).

FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
\tCreationTimeStamp:  {
\t\tVersion: 1000
\t\tYear: ${ts.getFullYear()}
\t\tMonth: ${ts.getMonth() + 1}
\t\tDay: ${ts.getDate()}
\t\tHour: ${ts.getHours()}
\t\tMinute: ${ts.getMinutes()}
\t\tSecond: ${ts.getSeconds()}
\t\tMillisecond: 0
\t}
\tCreator: "rodenOS Constructor 3D"
}
GlobalSettings:  {
\tVersion: 1000
\tProperties70:  {
\t\tP: "UpAxis", "int", "Integer", "",1
\t\tP: "UpAxisSign", "int", "Integer", "",1
\t\tP: "FrontAxis", "int", "Integer", "",2
\t\tP: "FrontAxisSign", "int", "Integer", "",1
\t\tP: "CoordAxis", "int", "Integer", "",0
\t\tP: "CoordAxisSign", "int", "Integer", "",1
\t\tP: "OriginalUpAxis", "int", "Integer", "",1
\t\tP: "OriginalUpAxisSign", "int", "Integer", "",1
\t\tP: "UnitScaleFactor", "double", "Number", "",${FBX_UNIT_SCALE_FACTOR}
\t\tP: "OriginalUnitScaleFactor", "double", "Number", "",${FBX_UNIT_SCALE_FACTOR}
\t}
}

Documents:  {
\tCount: 1
\tDocument: 1000000000, "", "Scene" {
\t\tProperties70:  {
\t\t\tP: "SourceObject", "object", "", ""
\t\t\tP: "ActiveAnimStackName", "KString", "", "", ""
\t\t}
\t\tRootNode: 0
\t}
}

References:  {
}

Definitions:  {
\tVersion: 100
\tCount: ${total}
\tObjectType: "GlobalSettings" {
\t\tCount: 1
\t}
\tObjectType: "NodeAttribute" {
\t\tCount: ${counts.attr}
\t}
\tObjectType: "Model" {
\t\tCount: ${counts.model}
\t}
\tObjectType: "Geometry" {
\t\tCount: ${counts.geometry}
\t}
\tObjectType: "Material" {
\t\tCount: ${counts.material}
\t}
}

Objects:  {
${objects.join('\n')}
}

Connections:  {
${connections.join('\n')}
}
`;
};

// ─────────────────────────────────────────────────────────────
// OBJ / MTL (alternativa: sin jerarquía real; los nombres de grupo la conservan)
// ─────────────────────────────────────────────────────────────
export const exportOBJ = (scene: FurnitureScene, mtlFileName = 'amoblamiento.mtl'): { obj: string; mtl: string } => {
  const modules = collectNodes(scene);
  const root = safeName(`Amoblamiento_${scene.name}`);
  const lines: string[] = [
    '# rodenOS - Constructor 3D',
    '# Unidades: milimetros (al importar en 3ds Max elegir unidades de archivo = milimetros)',
    '# Eje Y hacia arriba',
    `mtllib ${mtlFileName}`,
  ];
  let vBase = 1;
  const usedMats = new Map<string, [number, number, number]>();
  scene.modules.forEach(sm => sm.pieces.forEach(sp => usedMats.set(safeName(sp.piece.boardLabel), materialColorFor(sp.piece.boardLabel))));
  if (scene.modules.some(sm => sm.placeholder)) usedMats.set('Volumen_pendiente', materialColorFor('volumen'));

  modules.forEach(m => {
    m.meshes.forEach(mesh => {
      const bm = boxMesh(mesh.size, mesh.grainAxis);
      lines.push(`o ${mesh.name}`, `g ${root}/${m.name}/${mesh.name}`, `usemtl ${mesh.material}`);
      bm.positions.forEach(p => {
        const local: Vec3 = [p[0] + mesh.translation[0], p[1] + mesh.translation[1], p[2] + mesh.translation[2]];
        const r = rotateY(local, m.rotY);
        lines.push(`v ${n(r[0] + m.translation[0])} ${n(r[1] + m.translation[1])} ${n(r[2] + m.translation[2])}`);
      });
      bm.uvs.forEach(uv => lines.push(`vt ${n(uv[0])} ${n(uv[1])}`));
      bm.normals.forEach(nv => { const r = rotateY(nv, m.rotY); lines.push(`vn ${n(r[0])} ${n(r[1])} ${n(r[2])}`); });
      bm.quads.forEach(q => lines.push('f ' + q.map(i => `${i + vBase}/${i + vBase}/${i + vBase}`).join(' ')));
      vBase += bm.positions.length;
    });
  });
  const mtl: string[] = ['# rodenOS - materiales de referencia (reemplazar en 3ds Max)'];
  usedMats.forEach(([r, g, b], name) => mtl.push(`newmtl ${name}`, `Kd ${n(r)} ${n(g)} ${n(b)}`, 'Ka 0 0 0', 'Ks 0.1 0.1 0.1', 'Ns 8', 'illum 2', ''));
  return { obj: lines.join('\n') + '\n', mtl: mtl.join('\n') };
};

/** Nombre de archivo sugerido. */
export const exportFileBase = (name: string, exploded: boolean) =>
  `roden_${safeName(name)}${exploded ? '_despiece' : ''}`;

// Re-export para el visor
export type { Box };
