/**
 * Biblioteca de materiales del 3D: qué material toma cada placa y cómo se apoya la textura.
 */
import { describe, it, expect } from 'vitest';
import { matchMaterial, texturedBox, roughnessFor, LibraryMaterial } from '../utils/furniture3d/materialLibrary';

const mat = (name: string, over: Partial<LibraryMaterial> = {}): LibraryMaterial => ({
  id: name, name, kind: 'MELAMINA', color: '#cccccc', texture_path: 'x.jpg', texture_width_mm: 1000, texture_height_mm: 500,
  grain_vertical: true, gloss: 0.1, ...over,
});

describe('qué material toma cada placa', () => {
  const lib = [mat('Roble Kendal'), mat('Roble Kendal Natural'), mat('Blanco'), mat('Laca Blanca Brillante', { kind: 'LACA', texture_path: null })];
  it('por el nombre del color dentro de la etiqueta de la placa, sin importar acentos ni mayúsculas', () => {
    expect(matchMaterial('Roble Kendal 18mm MDF', lib)?.name).toBe('Roble Kendal');
    expect(matchMaterial('ROBLE KÉNDAL 18mm MDP', lib)?.name).toBe('Roble Kendal');
    expect(matchMaterial('Laca Blanca Brillante 18mm MDF', lib)?.kind).toBe('LACA');
  });
  it('si varios coinciden, gana el nombre más largo', () => {
    expect(matchMaterial('Roble Kendal Natural 18mm MDF', lib)?.name).toBe('Roble Kendal Natural');
  });
  it('solo palabras enteras: "Blanco" no toma "Blancol"; sin coincidencia, null', () => {
    expect(matchMaterial('Blancol 18mm MDP', lib)).toBeNull();
    expect(matchMaterial('Fondo Blanco 3mm', lib)?.name).toBe('Blanco');
    expect(matchMaterial('Melamina Color 18mm MDP', lib)).toBeNull();
  });
  it('brillo → rugosidad: mate áspero, brillante liso', () => {
    expect(roughnessFor({ gloss: 0 })).toBeCloseTo(0.9);
    expect(roughnessFor({ gloss: 1 })).toBeCloseTo(0.15);
  });
});

describe('textura a escala real con la veta de la pieza', () => {
  // Lateral 720 (alto, veta vertical) × 580 (prof.) × 18: veta en el eje Y (1)
  const size: [number, number, number] = [18, 720, 580];
  const uvsOfFace = (tb: ReturnType<typeof texturedBox>, normalX: number) => {
    const out: [number, number][] = [];
    for (let i = 0; i < tb.normals.length / 3; i++) if (tb.normals[i * 3] === normalX) out.push([tb.uvs[i * 2], tb.uvs[i * 2 + 1]]);
    return out;
  };
  const range = (vals: number[]) => Math.max(...vals) - Math.min(...vals);
  it('veta vertical en la imagen: el largo de la veta (720 mm) recorre el alto de la imagen (500 mm)', () => {
    const tb = texturedBox(size, 1, mat('x', { grain_vertical: true }));
    const face = uvsOfFace(tb, 1);   // cara lateral grande (+X)
    expect(range(face.map(u => u[1]))).toBeCloseTo(720 / 500);   // V: a lo largo de la veta
    expect(range(face.map(u => u[0]))).toBeCloseTo(580 / 1000);  // U: a lo ancho
  });
  it('veta horizontal en la imagen: el largo de la veta recorre el ancho de la imagen', () => {
    const tb = texturedBox(size, 1, mat('x', { grain_vertical: false }));
    const face = uvsOfFace(tb, 1);
    expect(range(face.map(u => u[0]))).toBeCloseTo(720 / 1000);
    expect(range(face.map(u => u[1]))).toBeCloseTo(580 / 500);
  });
  it('6 caras en triángulos (12)', () => {
    const tb = texturedBox(size, 1, mat('x'));
    expect(tb.index.length).toBe(36);
    expect(tb.positions.length / 3).toBe(24);
  });
});

describe('importar varias: nombre y marca desde el archivo', () => {
  it('saca la marca y arma el nombre', async () => {
    const { parseTextureFileName } = await import('../utils/furniture3d/materialLibrary');
    expect(parseTextureFileName('faplac_roble-kendal.jpg')).toEqual({ name: 'Roble Kendal', brand: 'Faplac' });
    expect(parseTextureFileName('EGGER H1145 ST10 ROBLE BARDOLINO.png')).toEqual({ name: 'H1145 ST10 Roble Bardolino', brand: 'Egger' });
    expect(parseTextureFileName('Nogal Lincoln.jpeg')).toEqual({ name: 'Nogal Lincoln', brand: null });
    expect(parseTextureFileName('Gris Grafito_Faplac.webp')).toEqual({ name: 'Gris Grafito', brand: 'Faplac' });
  });
});
