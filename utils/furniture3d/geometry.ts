/**
 * rødën OS — Constructor 3D: geometría del amoblamiento (puro, sin three.js ni React)
 *
 * Toma los módulos del estimador y ubica en 3D cada pieza del despiece que ya calcula
 * calculateModuleParts (utils/estimatorEngine.ts). No calcula piezas propias: cada pieza 3D
 * referencia la pieza del despiece de la que sale (partIndex) y conserva sus medidas, así el
 * modelo y el despiece del taller no pueden divergir.
 *
 * Coordenadas (mm). Origen de cada módulo: esquina izquierda-inferior-trasera.
 *   x → ancho (izq → der), y → alto (abajo → arriba), z → profundidad (atrás → frente).
 * Los frentes se dibujan DELANTE de la profundidad D (D = profundidad de la estructura).
 *
 * Reglas confirmadas por el taller y usadas acá:
 *   - Tapa y base sobre los laterales (lateral = H − 36).
 *   - Correderas 12,5mm por lado; caja de cajón 15mm; fondo de cajón en ranura (caja − 4mm/lado).
 * Todo lo que NO está definido en el sistema se marca en `notes` del módulo (supuestos de
 * dibujo) y en PENDING_RULES; no altera medidas ni costos.
 */
import { CalculatedPart } from '../../types';
import { calculateModuleParts, getFrontLayout, getBoardLabel, isVisibleFrontPiece } from '../estimatorEngine';
import { SPECIAL_MANUAL_ID } from '../specialModules';

export type Vec3 = [number, number, number];
export interface Box { min: Vec3; max: Vec3 }
export type RotY = 0 | 90 | 180 | 270;

export interface ModuleLayout3D { x: number; y: number; z: number; rotY: RotY }

export type PieceRole = 'carcass' | 'back' | 'shelf' | 'front' | 'drawer' | 'other';

export interface Piece3D {
  key: string;
  partIndex: number;          // índice en calculateModuleParts(módulo)
  copy: number;               // copia dentro de part.quantity
  name: string;               // nombre de la pieza del despiece
  material: string;           // código de material del despiece (18mm_White, 3mm_White…)
  boardLabel: string;         // etiqueta de placa (getBoardLabel): misma que optimizador / planilla
  grain: string;
  thickness: number;
  partSize: { width: number; height: number };  // medidas del despiece (mm)
  box: Box;                   // en coordenadas locales del módulo (mm)
  grainAxis: 0 | 1 | 2;       // eje 3D por el que corre la veta (para UV / renders)
  role: PieceRole;
  groove?: boolean;           // va en ranura: solapamiento intencional con su alojamiento
  hingeSide?: 'left' | 'right';
}

export type PlacementStatus = 'placed' | 'approximate' | 'unplaced';

export interface PlacedModule {
  key: string;
  moduleId: string;
  moduleIndex: number;
  instance: number;
  name: string;
  templateId: string | null;   // null = módulo estándar
  dims: { w: number; h: number; d: number };
  layout: ModuleLayout3D;      // ubicación de ESTA instancia en el mueble
  status: PlacementStatus;
  notes: string[];
  pieces: Piece3D[];
  gridPieces: Piece3D[];       // despiece en grilla (para módulos sin ubicar / vista de piezas)
  localBox: Box;               // volumen local (incluye frentes)
  worldBox: Box;
}

export type IssueLevel = 'error' | 'warning' | 'info';
export interface AssemblyIssue {
  level: IssueLevel;
  code: 'INVALID_DIMENSION' | 'FRONT_OVERFLOW' | 'MODULE_OVERLAP' | 'MODULE_GAP' | 'PIECE_OVERLAP' | 'UNPLACED_MODULE' | 'APPROXIMATE_MODULE';
  message: string;
  moduleKeys?: string[];
  pieceKeys?: string[];
}

export interface Assembly {
  name: string;
  modules: PlacedModule[];
  bbox: Box;
  size: { w: number; h: number; d: number };
  issues: AssemblyIssue[];
}

// Reglas de dibujo que el sistema NO define y se asumieron solo para la vista 3D.
export const PENDING_RULES: string[] = [
  'Frentes: se dibujan delante de la profundidad D (se asume que D no incluye el frente).',
  'Frentes combinados: orden de arriba hacia abajo = abatibles, cajones, puertas.',
  'Estantes: distribución equidistante en el alto interior, apoyados contra el fondo.',
  'Fondo 3mm: posición de la ranura respecto del canto trasero (se dibuja al ras atrás).',
  'Caja de cajón: alto fijo 120mm (regla actual del despiece) y posición vertical centrada en su fila.',
  'Fondo de cajón: altura de la ranura (se dibuja a 10mm de la base de la caja).',
  'Fondo 5,5mm y fondo estructural 18mm: sus medidas (H − 18) no son coherentes con tapas sobre laterales (alto interior H − 36).',
  'Sentido de apertura de puertas: por defecto bisagra izquierda (1 puerta) y pares hacia afuera (2 o más).',
];

// ─────────────────────────────────────────────────────────────
// Utilidades de cajas
// ─────────────────────────────────────────────────────────────

export const boxSize = (b: Box): Vec3 => [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
export const boxCenter = (b: Box): Vec3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const mkBox = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => ({ min: [x0, y0, z0], max: [x1, y1, z1] });
export const unionBox = (boxes: Box[]): Box => {
  if (boxes.length === 0) return mkBox(0, 0, 0, 0, 0, 0);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  boxes.forEach(b => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], b.min[i]); max[i] = Math.max(max[i], b.max[i]); } });
  return { min, max };
};
/** Volumen de intersección (mm³); 0 si solo se tocan. */
export const overlapVolume = (a: Box, b: Box, tol = 0.01): number => {
  let v = 1;
  for (let i = 0; i < 3; i++) {
    const o = Math.min(a.max[i], b.max[i]) - Math.max(a.min[i], b.min[i]);
    if (o <= tol) return 0;
    v *= o;
  }
  return v;
};

/** Rotación sobre Y (misma convención que three.js: ángulo positivo = antihorario visto desde +Y). */
export const rotateY = (p: Vec3, deg: number): Vec3 => {
  const r = (deg * Math.PI) / 180;
  const c = Math.round(Math.cos(r) * 1e9) / 1e9, s = Math.round(Math.sin(r) * 1e9) / 1e9;
  return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
};
export const transformBox = (b: Box, layout: ModuleLayout3D): Box => {
  const corners: Vec3[] = [];
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) corners.push([x, y, z]);
  const pts = corners.map(c => { const r = rotateY(c, layout.rotY); return [r[0] + layout.x, r[1] + layout.y, r[2] + layout.z] as Vec3; });
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  pts.forEach(p => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); } });
  return { min, max };
};

export const materialThickness = (material: string): number => {
  if (material.includes('18mm')) return 18;
  if (material.includes('15mm')) return 15;
  if (material.includes('5.5mm') || material.includes('55mm')) return 5.5;
  if (material.includes('3mm')) return 3;
  return 18;
};

// ─────────────────────────────────────────────────────────────
// Ubicación de piezas por tipo de módulo (registro ampliable)
// ─────────────────────────────────────────────────────────────

interface PlaceResult { pieces: Piece3D[]; status: PlacementStatus; notes: string[] }
type Placer = (mod: any, parts: CalculatedPart[]) => PlaceResult | null;

/** Crea la pieza 3D a partir de la pieza del despiece y su caja; calcula el eje de veta. */
const makePiece = (
  mod: any, parts: CalculatedPart[], partIndex: number, copy: number, box: Box, role: PieceRole,
  extra: Partial<Piece3D> = {},
): Piece3D => {
  const part = parts[partIndex];
  const size = boxSize(box);
  // La veta corre por la dimensión del despiece indicada en grain: horizontal → width, vertical → height.
  const grainLen = part.grain === 'vertical' ? part.height : part.width;
  let grainAxis: 0 | 1 | 2 = 0;
  let best = Infinity;
  ([0, 1, 2] as const).forEach(a => { const d = Math.abs(size[a] - grainLen); if (d < best) { best = d; grainAxis = a; } });
  return {
    key: `${mod.id}/p${partIndex}c${copy}`,
    partIndex, copy, name: part.name, material: part.material,
    boardLabel: getBoardLabel(mod, part), grain: part.grain || 'free',
    thickness: materialThickness(part.material),
    partSize: { width: part.width, height: part.height },
    box, grainAxis, role, ...extra,
  };
};

/** Copias pendientes de cada pieza del despiece (para consumirlas en orden). */
const copyCounter = () => {
  const used = new Map<number, number>();
  return (idx: number) => { const n = used.get(idx) || 0; used.set(idx, n + 1); return n; };
};

/**
 * Estructura tipo caja: tapa/base sobre laterales, fondo, estantes/bandejas y, en el módulo
 * estándar, frentes y cajones. Lo usan el módulo estándar y las plantillas con esa misma
 * construcción (Módulo Abierto, Biblioteca, Botineros).
 */
const placeCarcass: Placer = (mod, parts) => {
  const W = mod.width || 0, H = mod.height || 0, D = mod.depth || 0;
  const pieces: Piece3D[] = [];
  const notes: string[] = [];
  let status = 'placed' as PlacementStatus;
  const nextCopy = copyCounter();
  const idxOf = (re: RegExp) => parts.map((p, i) => (re.test(p.name) ? i : -1)).filter(i => i >= 0);

  // Estructura
  idxOf(/^Tapa superior/).forEach(i => pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(0, W, H - 18, H, 0, D), 'carcass')));
  idxOf(/^Base inferior/).forEach(i => pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(0, W, 0, 18, 0, D), 'carcass')));
  idxOf(/^Lateral$/).forEach(i => {
    const p = parts[i];
    const depth = p.width, height = p.height;
    for (let k = 0; k < (p.quantity || 1); k++) {
      const x0 = k % 2 === 0 ? 0 : W - 18;
      pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(x0, x0 + 18, 18, 18 + height, D - depth, D), 'carcass'));
    }
  });

  // Fondo del módulo (no el del cajón)
  let backFace = 0; // z interior del fondo
  idxOf(/^Fondo/).filter(i => !/caj/i.test(parts[i].name)).forEach(i => {
    const p = parts[i];
    const t = materialThickness(p.material);
    const x0 = (W - p.width) / 2, y0 = (H - p.height) / 2;
    pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(x0, x0 + p.width, y0, y0 + p.height, 0, t), 'back'));
    backFace = Math.max(backFace, t);
    if (t > 3) notes.push(`${p.name}: medida H − 18 incoherente con tapas sobre laterales (regla pendiente).`);
  });

  // Estantes y bandejas: equidistantes en el alto interior (regla de separación pendiente)
  const shelfIdx = idxOf(/^(Estante|Bandeja)/);
  const shelfCount = shelfIdx.reduce((a, i) => a + (parts[i].quantity || 1), 0);
  let shelfN = 0;
  const shelfTops: { y: number; zFront: number }[] = [];
  shelfIdx.forEach(i => {
    const p = parts[i];
    for (let k = 0; k < (p.quantity || 1); k++) {
      shelfN++;
      const yc = 18 + ((H - 36) * shelfN) / (shelfCount + 1);
      const x0 = (W - p.width) / 2;
      const z0 = backFace;
      pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(x0, x0 + p.width, yc - 9, yc + 9, z0, z0 + p.height), 'shelf'));
      shelfTops.push({ y: yc + 9, zFront: z0 + p.height });
      if (/inclinada/i.test(p.name)) { status = 'approximate'; }
    }
  });
  if (shelfCount > 0) notes.push('Estantes/bandejas distribuidos en partes iguales (separación real pendiente).');
  if (status === 'approximate') notes.push('Bandejas inclinadas 30° dibujadas horizontales.');
  // Frentín de bandeja (botinero fijo): al frente de cada bandeja
  idxOf(/^Frent[ií]n/).forEach(i => {
    const p = parts[i];
    for (let k = 0; k < (p.quantity || 1); k++) {
      const s = shelfTops[k] || shelfTops[shelfTops.length - 1] || { y: 18, zFront: D };
      const x0 = (W - p.width) / 2;
      pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(x0, x0 + p.width, s.y, s.y + p.height, s.zFront - 18, s.zFront), 'front'));
    }
  });

  // Frentes del módulo estándar (puertas / cajones / abatibles) según getFrontLayout
  const layout = getFrontLayout(mod);
  const nDr = mod.cntDrawers || 0, nFl = mod.cntFlaps || 0, nDo = mod.cntDoors || 0;
  const rows: { kind: 'flap' | 'drawer' | 'door'; h: number }[] = [];
  for (let k = 0; k < nFl; k++) rows.push({ kind: 'flap', h: layout.flapH });
  for (let k = 0; k < nDr; k++) rows.push({ kind: 'drawer', h: layout.drawerH });
  if (nDo > 0 && layout.doorH > 0) rows.push({ kind: 'door', h: layout.doorH });
  let top = H - 3;
  const rowY: { kind: string; y0: number; y1: number }[] = [];
  rows.forEach(r => { rowY.push({ kind: r.kind, y0: top - r.h, y1: top }); top -= r.h + 4; });
  const zF0 = D, zF1 = D + 18;

  const drawerRows = rowY.filter(r => r.kind === 'drawer');
  const flapRows = rowY.filter(r => r.kind === 'flap');
  const doorRow = rowY.find(r => r.kind === 'door');

  idxOf(/^Frente Abatible/).forEach(i => {
    const p = parts[i];
    for (let k = 0; k < (p.quantity || 1); k++) {
      const r = flapRows[k]; if (!r) continue;
      const x0 = (W - p.width) / 2;
      pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(x0, x0 + p.width, r.y0, r.y0 + p.height, zF0, zF1), 'front'));
    }
  });
  idxOf(/^Frente Cajón/).forEach(i => {
    const p = parts[i];
    for (let k = 0; k < (p.quantity || 1); k++) {
      const r = drawerRows[k]; if (!r) continue;
      const x0 = (W - p.width) / 2;
      pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(x0, x0 + p.width, r.y0, r.y0 + p.height, zF0, zF1), 'front'));
    }
  });
  idxOf(/^Puerta/).forEach(i => {
    const p = parts[i];
    const n = p.quantity || 1;
    const gap = n > 1 ? (W - 6 - n * p.width) / (n - 1) : 0;
    const y0 = doorRow ? doorRow.y0 : 3;
    for (let k = 0; k < n; k++) {
      const x0 = n > 1 ? 3 + k * (p.width + gap) : (W - p.width) / 2;
      const hingeSide: 'left' | 'right' = n === 1
        ? (mod.doorHingeSide === 'RIGHT' ? 'right' : 'left')
        : (k < n / 2 ? 'left' : 'right');
      pieces.push(makePiece(mod, parts, i, nextCopy(i), mkBox(x0, x0 + p.width, y0, y0 + p.height, zF0, zF1), 'front', { hingeSide }));
    }
  });

  // Interiores de cajón: una caja por fila de cajón
  const latIdx = idxOf(/^Lateral Cajón/)[0];
  const testaIdx = idxOf(/^Contra\/Frente Cajón/)[0];
  const fondoIdx = idxOf(/^Fondo Cajón/)[0];
  if (latIdx !== undefined && testaIdx !== undefined) {
    const lat = parts[latIdx], testa = parts[testaIdx];
    const tSide = materialThickness(lat.material);
    const outerW = testa.width + 2 * tSide;
    const bx0 = (W - outerW) / 2;
    const L = lat.width;                 // largo de la caja (D − 20)
    const bz0 = D - L, bz1 = D;
    const bh = lat.height;               // alto de caja (120)
    drawerRows.forEach(r => {
      let yb = (r.y0 + r.y1) / 2 - bh / 2;
      yb = Math.max(18, Math.min(yb, H - 18 - bh));
      pieces.push(makePiece(mod, parts, latIdx, nextCopy(latIdx), mkBox(bx0, bx0 + tSide, yb, yb + bh, bz0, bz1), 'drawer'));
      pieces.push(makePiece(mod, parts, latIdx, nextCopy(latIdx), mkBox(bx0 + outerW - tSide, bx0 + outerW, yb, yb + bh, bz0, bz1), 'drawer'));
      const tx0 = bx0 + tSide;
      const tT = materialThickness(testa.material);
      pieces.push(makePiece(mod, parts, testaIdx, nextCopy(testaIdx), mkBox(tx0, tx0 + testa.width, yb, yb + bh, bz0, bz0 + tT), 'drawer'));
      pieces.push(makePiece(mod, parts, testaIdx, nextCopy(testaIdx), mkBox(tx0, tx0 + testa.width, yb, yb + bh, bz1 - tT, bz1), 'drawer'));
      if (fondoIdx !== undefined) {
        const f = parts[fondoIdx];
        const fx0 = (W - f.width) / 2, fz0 = bz0 + (L - f.height) / 2;
        pieces.push(makePiece(mod, parts, fondoIdx, nextCopy(fondoIdx), mkBox(fx0, fx0 + f.width, yb + 10, yb + 13, fz0, fz0 + f.height), 'drawer', { groove: true }));
      }
    });
  }

  // ¿Quedó alguna pieza del despiece sin ubicar? → el módulo no está resuelto
  const placedCount = new Map<number, number>();
  pieces.forEach(p => placedCount.set(p.partIndex, (placedCount.get(p.partIndex) || 0) + 1));
  const missing = parts.some((p, i) => (placedCount.get(i) || 0) !== (p.quantity || 1));
  if (missing) return null;
  return { pieces, status, notes };
};

/** Plantillas de una sola pieza que ocupa todo el volumen del módulo (uno de sus lados = espesor). */
const placeSinglePanel: Placer = (mod, parts) => {
  if (parts.length !== 1 || (parts[0].quantity || 1) !== 1) return null;
  const W = mod.width || 0, H = mod.height || 0, D = mod.depth || 0;
  const p = parts[0];
  const t = materialThickness(p.material);
  const dims = [W, H, D];
  const tAxis = dims.findIndex(v => Math.abs(v - t) < 0.01);
  if (tAxis < 0) return null;
  const others = dims.filter((_, i) => i !== tAxis).sort((a, b) => a - b);
  const pd = [p.width, p.height].sort((a, b) => a - b);
  if (Math.abs(others[0] - pd[0]) > 0.01 || Math.abs(others[1] - pd[1]) > 0.01) return null;
  const role: PieceRole = isVisibleFrontPiece(p.name) ? 'front' : 'carcass';
  const extra: Partial<Piece3D> = role === 'front' ? { hingeSide: mod.doorHingeSide === 'RIGHT' ? 'right' : 'left' } : {};
  return { pieces: [makePiece(mod, parts, 0, 0, mkBox(0, W, 0, H, 0, D), role, extra)], status: 'placed', notes: [] };
};

/** Estante flotante (2 caras de 18) y Tapa horizontal (18 o 36 con fajas de regrueso). */
const placeStackedTop: Placer = (mod, parts) => {
  const W = mod.width || 0, D = mod.depth || 0;
  const pieces: Piece3D[] = [];
  const nextCopy = copyCounter();
  const top = parts.findIndex(p => /^(Tapa horizontal|Estante — cara superior)/.test(p.name));
  const bottom = parts.findIndex(p => /^Estante — cara inferior/.test(p.name));
  const fajaL = parts.findIndex(p => /^Faja regrueso — largo/.test(p.name));
  const fajaP = parts.findIndex(p => /^Faja regrueso — profundidad/.test(p.name));
  if (top < 0) return null;
  const hasUnder = bottom >= 0 || fajaL >= 0;
  const yTop = hasUnder ? 18 : 0;
  pieces.push(makePiece(mod, parts, top, nextCopy(top), mkBox(0, W, yTop, yTop + 18, 0, D), 'carcass'));
  if (bottom >= 0) pieces.push(makePiece(mod, parts, bottom, nextCopy(bottom), mkBox(0, W, 0, 18, 0, D), 'carcass'));
  if (fajaL >= 0) {
    const f = parts[fajaL];
    pieces.push(makePiece(mod, parts, fajaL, nextCopy(fajaL), mkBox(0, f.width, 0, 18, D - f.height, D), 'carcass'));
    pieces.push(makePiece(mod, parts, fajaL, nextCopy(fajaL), mkBox(0, f.width, 0, 18, 0, f.height), 'carcass'));
  }
  if (fajaP >= 0) {
    const f = parts[fajaP];
    const z0 = (D - f.width) / 2;
    pieces.push(makePiece(mod, parts, fajaP, nextCopy(fajaP), mkBox(0, f.height, 0, 18, z0, z0 + f.width), 'carcass'));
    pieces.push(makePiece(mod, parts, fajaP, nextCopy(fajaP), mkBox(W - f.height, W, 0, 18, z0, z0 + f.width), 'carcass'));
  }
  const count = new Map<number, number>();
  pieces.forEach(p => count.set(p.partIndex, (count.get(p.partIndex) || 0) + 1));
  if (parts.some((p, i) => (count.get(i) || 0) !== (p.quantity || 1))) return null;
  return { pieces, status: 'placed', notes: [] };
};

/**
 * Registro de ubicadores por tipo de módulo. Para sumar una plantilla nueva alcanza con
 * agregar su id acá (reutilizando un ubicador o escribiendo uno propio).
 * Plantillas ausentes → se muestran sin ubicar (volumen + despiece en grilla).
 */
export const MODULE_PLACERS: Record<string, Placer> = {
  STANDARD: placeCarcass,
  MODULO_ABIERTO: placeCarcass,
  BIBLIOTECA: placeCarcass,
  BOTINERO_EXTRAIBLE: placeCarcass,
  BOTINERO_FIJO: placeCarcass,
  ESTANTE_18MM: placeSinglePanel,
  PUERTA_18MM: placeSinglePanel,
  LATERAL_APLICADO: placeSinglePanel,
  DIVISOR_VERTICAL: placeSinglePanel,
  AJUSTE: placeSinglePanel,
  ZOCALO_APLICADO: placeSinglePanel,
  TAPA_HORIZONTAL: placeStackedTop,
  ESTANTE_FLOTANTE: placeStackedTop,
};

export const isManualModule = (mod: any): boolean =>
  mod?.specialTemplateId === SPECIAL_MANUAL_ID || mod?.moduleType === 'MANUAL';

const templateIdOf = (mod: any): string | null =>
  mod?.isSpecialModule && mod?.specialTemplateId && !isManualModule(mod) ? mod.specialTemplateId : null;

/** Despiece en grilla (piezas sin ubicar): una fila de piezas paradas, separadas 50mm. */
const gridPieces = (mod: any, parts: CalculatedPart[]): Piece3D[] => {
  const pieces: Piece3D[] = [];
  let x = 0;
  parts.forEach((p, i) => {
    const t = materialThickness(p.material);
    for (let k = 0; k < (p.quantity || 1); k++) {
      pieces.push(makePiece(mod, parts, i, k, mkBox(x, x + p.width, 0, p.height, 0, t), isVisibleFrontPiece(p.name) ? 'front' : 'other'));
      x += p.width + 50;
    }
  });
  return pieces;
};

/** Ubica todas las piezas de UN módulo en sus coordenadas locales. */
export const placeModule = (mod: any): { pieces: Piece3D[]; status: PlacementStatus; notes: string[]; gridPieces: Piece3D[] } => {
  if (isManualModule(mod)) return { pieces: [], status: 'unplaced', notes: ['Módulo manual: sin geometría (solo costo).'], gridPieces: [] };
  const parts = calculateModuleParts(mod);
  const tpl = templateIdOf(mod);
  const placer = MODULE_PLACERS[tpl || 'STANDARD'];
  const res = placer ? placer(mod, parts) : null;
  if (!res) {
    return {
      pieces: [], status: 'unplaced', gridPieces: gridPieces(mod, parts),
      notes: [`Plantilla ${tpl || 'estándar'}: ubicación 3D de piezas no definida; se muestra el volumen y el despiece en grilla.`],
    };
  }
  return { ...res, gridPieces: gridPieces(mod, parts) };
};

// ─────────────────────────────────────────────────────────────
// Composición del amoblamiento
// ─────────────────────────────────────────────────────────────

const hasLayout = (m: any): boolean =>
  m?.layout3d && [m.layout3d.x, m.layout3d.y, m.layout3d.z].every((v: any) => typeof v === 'number' && isFinite(v));

/**
 * Layout por defecto: módulos sin posición guardada se alinean en fila sobre el piso (de
 * izquierda a derecha) a continuación del último módulo con posición apoyado en el piso. Las copias (Cant.) se colocan
 * una al lado de la otra en el eje x local del módulo.
 */
export const resolveLayouts = (modules: any[]): ModuleLayout3D[] => {
  let cursor = 0;
  // Solo los módulos apoyados en el piso (y = 0) empujan la fila automática: una alacena
  // colgada no debe correr a los bajos.
  modules.forEach(m => {
    if (hasLayout(m) && Math.abs(m.layout3d.y) < 1) {
      const w = (m.width || 0) * (m.quantity || 1);
      const rot = m.layout3d.rotY || 0;
      const end = rot === 0 ? m.layout3d.x + w : rot === 180 ? m.layout3d.x : m.layout3d.x + (m.depth || 0);
      cursor = Math.max(cursor, end);
    }
  });
  return modules.map(m => {
    if (hasLayout(m)) return { x: m.layout3d.x, y: m.layout3d.y, z: m.layout3d.z, rotY: ([0, 90, 180, 270].includes(m.layout3d.rotY) ? m.layout3d.rotY : 0) as RotY };
    const l: ModuleLayout3D = { x: cursor, y: 0, z: 0, rotY: 0 };
    if (!isManualModule(m)) cursor += (m.width || 0) * (m.quantity || 1);
    return l;
  });
};

export const buildAssembly = (name: string, modules: any[]): Assembly => {
  const layouts = resolveLayouts(modules);
  const placed: PlacedModule[] = [];
  const issues: AssemblyIssue[] = [];

  modules.forEach((mod, mi) => {
    if (isManualModule(mod)) return;
    const W = mod.width || 0, H = mod.height || 0, D = mod.depth || 0;
    const base = placeModule(mod);
    const qty = Math.max(1, mod.quantity || 1);
    const label = mod.name || `Módulo ${mi + 1}`;

    // Validaciones de medidas
    if (!(W > 0 && H > 0 && D > 0)) {
      issues.push({ level: 'error', code: 'INVALID_DIMENSION', message: `${label}: ancho, alto y profundidad deben ser mayores a 0 (${W}×${H}×${D}).`, moduleKeys: [] });
    }
    const parts = calculateModuleParts(mod);
    parts.forEach(p => {
      if (!((p.width || 0) > 0 && (p.height || 0) > 0)) {
        issues.push({ level: 'error', code: 'INVALID_DIMENSION', message: `${label}: la pieza "${p.name}" queda con medida ${Math.round(p.width)}×${Math.round(p.height)} (el módulo es demasiado chico para esa configuración).` });
      }
    });
    if (!templateIdOf(mod) && getFrontLayout(mod).overflow) {
      issues.push({ level: 'error', code: 'FRONT_OVERFLOW', message: `${label}: los altos de frente cargados no entran en el módulo.` });
    }

    for (let inst = 0; inst < qty; inst++) {
      const l = layouts[mi];
      const off = rotateY([inst * W, 0, 0], l.rotY);
      const layout: ModuleLayout3D = { x: l.x + off[0], y: l.y + off[1], z: l.z + off[2], rotY: l.rotY };
      const key = `${mod.id || `m${mi}`}#${inst}`;
      const rekey = (p: Piece3D) => ({ ...p, key: `${key}/${p.key.split('/').pop()}` });
      const pieces = base.pieces.map(rekey);
      const gridPieces = base.gridPieces.map(rekey);
      const volume = mkBox(0, W, 0, H, 0, D);
      const localBox = pieces.length ? unionBox([volume, ...pieces.map(p => p.box)]) : volume;
      placed.push({
        key, moduleId: mod.id, moduleIndex: mi, instance: inst,
        name: qty > 1 ? `${label} (${inst + 1}/${qty})` : label,
        templateId: templateIdOf(mod), dims: { w: W, h: H, d: D }, layout,
        status: base.status, notes: base.notes, pieces, gridPieces, localBox,
        worldBox: transformBox(localBox, layout),
      });
    }
    if (base.status === 'unplaced') {
      issues.push({ level: 'warning', code: 'UNPLACED_MODULE', message: `${label}: ${base.notes[0]}` });
    } else if (base.status === 'approximate') {
      issues.push({ level: 'info', code: 'APPROXIMATE_MODULE', message: `${label}: ${base.notes.join(' ')}` });
    }
  });

  // Solapamientos y separaciones entre módulos (volumen de estructura, sin frentes)
  const carcassWorld = (pm: PlacedModule) => transformBox(mkBox(0, pm.dims.w, 0, pm.dims.h, 0, pm.dims.d), pm.layout);
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = carcassWorld(placed[i]), b = carcassWorld(placed[j]);
      const v = overlapVolume(a, b);
      if (v > 0) {
        issues.push({ level: 'error', code: 'MODULE_OVERLAP', message: `${placed[i].name} se superpone con ${placed[j].name}.`, moduleKeys: [placed[i].key, placed[j].key] });
        continue;
      }
      // separación chica (0 < g ≤ 5mm) en un eje con superposición en los otros dos
      for (let ax = 0; ax < 3; ax++) {
        const others = [0, 1, 2].filter(k => k !== ax);
        const overlapOthers = others.every(k => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 0.01);
        if (!overlapOthers) continue;
        const g = Math.max(b.min[ax] - a.max[ax], a.min[ax] - b.max[ax]);
        if (g > 0.01 && g <= 5) {
          issues.push({ level: 'warning', code: 'MODULE_GAP', message: `Separación de ${Math.round(g * 10) / 10} mm entre ${placed[i].name} y ${placed[j].name} (¿intencional?).`, moduleKeys: [placed[i].key, placed[j].key] });
        }
      }
    }
  }

  // Solapamientos de piezas dentro de cada módulo (control de la ubicación y de reglas pendientes)
  const seenModule = new Set<string>();
  placed.forEach(pm => {
    if (pm.instance > 0 || seenModule.has(pm.moduleId)) return;
    seenModule.add(pm.moduleId);
    findPieceOverlaps(pm.pieces).forEach(([a, b]) => {
      issues.push({ level: 'warning', code: 'PIECE_OVERLAP', message: `${pm.name}: "${a.name}" y "${b.name}" se solapan (revisar regla de fabricación).`, pieceKeys: [a.key, b.key] });
    });
  });

  const bbox = unionBox(placed.map(p => p.worldBox));
  const s = boxSize(bbox);
  return { name, modules: placed, bbox, size: { w: s[0], h: s[1], d: s[2] }, issues };
};

/** Pares de piezas que se solapan, ignorando los alojamientos intencionales (ranuras). */
export const findPieceOverlaps = (pieces: Piece3D[]): [Piece3D, Piece3D][] => {
  const out: [Piece3D, Piece3D][] = [];
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i], b = pieces[j];
      if ((a.groove && b.role === 'drawer') || (b.groove && a.role === 'drawer')) continue;
      if (overlapVolume(a.box, b.box) > 0) out.push([a, b]);
    }
  }
  return out;
};

// ─────────────────────────────────────────────────────────────
// Despiece explotado
// ─────────────────────────────────────────────────────────────

export interface ScenePiece { piece: Piece3D; box: Box }           // box en coordenadas locales del módulo
export interface SceneModule { module: PlacedModule; layout: ModuleLayout3D; pieces: ScenePiece[]; placeholder?: Box }
export interface FurnitureScene { name: string; modules: SceneModule[]; exploded: boolean }

/**
 * Escena lista para dibujar o exportar.
 * - factor 0 = ensamblado.
 * - factor > 0 = explotado: cada pieza se aleja del centro de su módulo y los módulos se
 *   separan entre sí. Las medidas de cada pieza no cambian (solo su posición).
 * - Módulos sin ubicar: ensamblado = volumen (placeholder); explotado = despiece en grilla.
 */
export const buildScene = (assembly: Assembly, factor = 0, onlyModuleKey?: string): FurnitureScene => {
  const center = boxCenter(assembly.bbox);
  const mods = assembly.modules.filter(m => !onlyModuleKey || m.key === onlyModuleKey);
  return {
    name: assembly.name,
    exploded: factor > 0,
    modules: mods.map(m => {
      const mc = boxCenter(m.localBox);
      let layout = m.layout;
      if (factor > 0 && !onlyModuleKey) {
        const wc = boxCenter(m.worldBox);
        layout = { ...layout, x: layout.x + (wc[0] - center[0]) * factor, z: layout.z + (wc[2] - center[2]) * factor };
      }
      if (m.status === 'unplaced') {
        if (factor > 0) {
          return { module: m, layout, pieces: m.gridPieces.map(p => ({ piece: p, box: p.box })) };
        }
        return { module: m, layout, pieces: [], placeholder: mkBox(0, m.dims.w, 0, m.dims.h, 0, m.dims.d) };
      }
      return {
        module: m, layout,
        pieces: m.pieces.map(p => {
          if (factor <= 0) return { piece: p, box: p.box };
          const pc = boxCenter(p.box);
          const d: Vec3 = [(pc[0] - mc[0]) * factor, (pc[1] - mc[1]) * factor, (pc[2] - mc[2]) * factor];
          return { piece: p, box: { min: [p.box.min[0] + d[0], p.box.min[1] + d[1], p.box.min[2] + d[2]], max: [p.box.max[0] + d[0], p.box.max[1] + d[1], p.box.max[2] + d[2]] } };
        }),
      };
    }),
  };
};

// ─────────────────────────────────────────────────────────────
// Reordenar arrastrando (filas)
// ─────────────────────────────────────────────────────────────

/**
 * Fila = módulos sin girar (rotY 0) apoyados a la misma altura (y). Los bajos forman una fila,
 * las alacenas colgadas otra. Los módulos girados (alas de una L) no participan.
 */
export interface LayoutRow { y: number; top: number; members: number[] }   // members: moduleIndex ordenados por x

interface Span { x: number; w: number; layout: ModuleLayout3D; h: number }

const spansOf = (assembly: Assembly): Map<number, Span> => {
  const spans = new Map<number, Span>();
  assembly.modules.forEach(pm => {
    if (pm.layout.rotY !== 0) return;
    const s = spans.get(pm.moduleIndex);
    if (pm.instance === 0) spans.set(pm.moduleIndex, { x: pm.layout.x, w: (s?.w || 0) + pm.dims.w, layout: pm.layout, h: pm.dims.h });
    else if (s) s.w += pm.dims.w;
    else spans.set(pm.moduleIndex, { x: NaN, w: pm.dims.w, layout: pm.layout, h: pm.dims.h });
  });
  return spans;
};

export const layoutRows = (assembly: Assembly): LayoutRow[] => {
  const rows: LayoutRow[] = [];
  spansOf(assembly).forEach((s, mi) => {
    let row = rows.find(r => Math.abs(r.y - s.layout.y) < 1);
    if (!row) { row = { y: s.layout.y, top: s.layout.y, members: [] }; rows.push(row); }
    row.members.push(mi);
    row.top = Math.max(row.top, s.layout.y + s.h);
  });
  const spans = spansOf(assembly);
  rows.forEach(r => r.members.sort((a, b) => spans.get(a)!.x - spans.get(b)!.x));
  return rows.sort((a, b) => a.y - b.y);
};

/** Regla del taller: las alacenas van 600 mm por encima del tope de los bajomesadas. */
export const WALL_CABINET_GAP = 600;
/** Para el tope de los bajomesadas no cuentan las torres / columnas (más altas que esto). */
const BASE_CABINET_MAX_H = 1200;

export interface ReorderPlan {
  layouts: Map<number, ModuleLayout3D>;   // nueva ubicación (instancia 0) de los módulos que se mueven
  rowY: number;
  slot: number;                           // posición dentro de la fila destino
  changed: boolean;
}

/**
 * Plan para soltar el módulo `moduleIndex` con su centro en `pointer` (x, y del mundo, mm).
 * - Fila destino: la que contiene la altura del puntero (o la más cercana).
 * - Al sacarlo de su fila, los que estaban a su derecha se corren a la izquierda su ancho.
 * - Al insertarlo, los que quedan a su derecha se corren a la derecha su ancho.
 * Las separaciones que había entre los demás módulos se conservan.
 */
export const planReorder = (assembly: Assembly, moduleIndex: number, pointer: { x: number; y: number }): ReorderPlan | null => {
  const spans = spansOf(assembly);
  const d = spans.get(moduleIndex);
  if (!d) return null;
  const rows = layoutRows(assembly);
  const src = rows.find(r => r.members.includes(moduleIndex))!;
  // Sin alacenas todavía: fila virtual a 600 mm sobre el tope de los bajomesadas, para poder
  // subir un módulo arrastrándolo.
  const floor = rows.find(r => Math.abs(r.y) < 1);
  if (floor && !rows.some(r => r.y > 1)) {
    const baseTops = floor.members.map(mi => spans.get(mi)!.h).filter(h => h <= BASE_CABINET_MAX_H);
    if (baseTops.length) {
      floor.top = Math.max(...baseTops);           // la torre no "estira" la fila de bajos
      const y = floor.top + WALL_CABINET_GAP;
      rows.push({ y, top: y + d.h, members: [] });
    }
  }
  const dist = (r: LayoutRow) => pointer.y < r.y ? r.y - pointer.y : pointer.y > r.top ? pointer.y - r.top : 0;
  const dst = rows.reduce((best, r) => dist(r) < dist(best) ? r : best, src);

  const pos = new Map<number, number>();
  spans.forEach((s, mi) => pos.set(mi, s.x));
  // 1) sacarlo de su fila
  src.members.forEach(mi => { if (mi !== moduleIndex && pos.get(mi)! > d.x) pos.set(mi, pos.get(mi)! - d.w); });
  // 2) hueco en la fila destino
  const others = dst.members.filter(mi => mi !== moduleIndex).sort((a, b) => pos.get(a)! - pos.get(b)!);
  const slot = others.filter(mi => pos.get(mi)! + spans.get(mi)!.w / 2 < pointer.x).length;
  if (dst === src && slot === src.members.indexOf(moduleIndex)) {
    return { layouts: new Map(), rowY: dst.y, slot, changed: false };
  }
  let insertX: number;
  if (slot < others.length) insertX = pos.get(others[slot])!;
  else if (others.length) { const last = others[others.length - 1]; insertX = pos.get(last)! + spans.get(last)!.w; }
  else {
    // Fila vacía: alinear con el borde izquierdo más cercano de los módulos de abajo
    insertX = pointer.x - d.w / 2;
    const edges = (floor?.members || [])
      .filter(mi => mi !== moduleIndex && spans.get(mi)!.h <= BASE_CABINET_MAX_H)   // sobre una torre no va
      .map(mi => pos.get(mi)!);
    if (dst !== floor && edges.length) insertX = edges.reduce((b, e) => Math.abs(e - insertX) < Math.abs(b - insertX) ? e : b);
  }
  others.slice(slot).forEach(mi => pos.set(mi, pos.get(mi)! + d.w));

  const layouts = new Map<number, ModuleLayout3D>();
  spans.forEach((s, mi) => {
    if (mi === moduleIndex) return;
    if (Math.abs(pos.get(mi)! - s.x) > 1e-6) layouts.set(mi, { ...s.layout, x: pos.get(mi)! });
  });
  const z = others.length ? spans.get(others[0])!.layout.z : d.layout.z;
  layouts.set(moduleIndex, { x: insertX, y: dst.y, z, rotY: 0 });
  return { layouts, rowY: dst.y, slot, changed: true };
};
