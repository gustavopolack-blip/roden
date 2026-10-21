/**
 * Biblioteca de materiales del constructor 3D (tabla `material_library`, imágenes en el bucket
 * `material-textures`). Solo dibujo: no interviene en despiece ni costos.
 *
 * Cada pieza toma el material cuyo nombre aparece en su placa (la etiqueta del despiece, ej.
 * "Roble Kendal 18mm MDF" → "Roble Kendal"). Si varios coinciden, gana el nombre más largo
 * ("Roble Kendal Natural" antes que "Roble Kendal"). Sin coincidencia, la pieza conserva el color
 * de referencia de siempre.
 */
import { Vec3 } from './geometry';
import { boxMesh } from './exporters';

export type MaterialKind = 'MELAMINA' | 'LACA' | 'ENCHAPADO';

export interface LibraryMaterial {
  id: string;
  name: string;
  brand?: string | null;
  line?: string | null;
  kind: MaterialKind;
  color: string;                 // #rrggbb: base de la laca, o color si no hay textura
  texture_path?: string | null;
  texture_width_mm: number;      // medida real que cubre la imagen
  texture_height_mm: number;
  grain_vertical: boolean;       // en la imagen, la veta corre de arriba abajo
  gloss: number;                 // 0 mate … 1 brillante
}

export const TEXTURE_BUCKET = 'material-textures';

/** Minúsculas, sin acentos ni espacios repetidos. */
export const normalizeName = (s: string): string =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Material de la biblioteca para una placa (por nombre); null si ninguno coincide. */
export const matchMaterial = (boardLabel: string, library: LibraryMaterial[]): LibraryMaterial | null => {
  const label = ` ${normalizeName(boardLabel)} `;
  let best: LibraryMaterial | null = null;
  let bestLen = 0;
  library.forEach(m => {
    const n = normalizeName(m.name);
    if (n && label.includes(` ${n} `) && n.length > bestLen) { best = m; bestLen = n.length; }
  });
  return best;
};

/** Rugosidad del material (three.js) según el brillo cargado: mate 0,9 … brillante 0,15. */
export const roughnessFor = (m: Pick<LibraryMaterial, 'gloss'>): number => 0.9 - 0.75 * Math.min(1, Math.max(0, m.gloss));

/**
 * Caja de una pieza (mm, centrada) con coordenadas de textura a escala real: la veta de la imagen
 * sigue la veta de la pieza, y la imagen se repite cada `texture_width_mm` × `texture_height_mm`.
 * Devuelve arreglos planos listos para un BufferGeometry (triángulos).
 */
export const texturedBox = (size: Vec3, grainAxis: 0 | 1 | 2, m: Pick<LibraryMaterial, 'texture_width_mm' | 'texture_height_mm' | 'grain_vertical'>) => {
  const bm = boxMesh(size, grainAxis);   // UV en metros: U a lo largo de la veta
  const w = m.texture_width_mm / 1000, h = m.texture_height_mm / 1000;
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], index: number[] = [];
  bm.positions.forEach((p, i) => {
    positions.push(p[0], p[1], p[2]);
    normals.push(...bm.normals[i]);
    const [along, across] = bm.uvs[i];
    // veta vertical en la imagen: a lo largo de la veta = alto de la imagen
    if (m.grain_vertical) uvs.push(across / w, along / h); else uvs.push(along / w, across / h);
  });
  bm.polys.forEach(q => index.push(q[0], q[1], q[2], q[0], q[2], q[3]));
  return { positions, normals, uvs, index };
};
