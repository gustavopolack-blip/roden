/**
 * rødën OS — cutOptimizer.ts
 * Algoritmo: Guillotina recursiva con split adaptativo (BSSF)
 *
 * Mejoras sobre versión anterior:
 * 1. Respeta veta/grano — solo rota si la pieza lo permite
 * 2. Split adaptativo — elige entre corte horizontal/vertical según qué deja mayor área libre
 * 3. Retry con rotación — si una pieza no entra en orientación original, intenta rotada (si veta lo permite)
 * 4. Piezas que superan la placa en ambas orientaciones se reportan como error, no se ignoran
 */

// ─────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────

export type Grain = 'horizontal' | 'vertical' | 'free';

export interface Piece {
  id:       string;
  width:    number;
  height:   number;
  quantity: number;
  grain?:   Grain;     // 'horizontal' | 'vertical' | 'free'
  label?:   string;    // nombre legible para el plano visual
}

export interface Input {
  pieces:      Piece[];
  sheetWidth:  number;
  sheetHeight: number;
  kerf:        number;  // ancho de sierra en mm
}

export interface PlacedPiece {
  id:       string;
  label?:   string;
  x:        number;
  y:        number;
  width:    number;
  height:   number;
  rotated:  boolean;  // true si fue rotada respecto a la dimensión original
}

export interface Sheet {
  width:      number;
  height:     number;
  placements: PlacedPiece[];
  efficiency: number;  // % de aprovechamiento 0-100
  freeRects:  FreeRect[];
}

export interface CutPlanResult {
  sheets:       Sheet[];
  unplaceable:  { id: string; label?: string; reason: string }[];
}

// ─────────────────────────────────────────────────────────────
// TIPOS INTERNOS
// ─────────────────────────────────────────────────────────────

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ExpandedPiece {
  id:      string;
  label?:  string;
  width:   number;
  height:  number;
  grain:   Grain;
  area:    number;
}

// ─────────────────────────────────────────────────────────────
// LÓGICA DE ROTACIÓN
// ─────────────────────────────────────────────────────────────

/**
 * Determina si una pieza puede rotarse manteniendo la veta correcta.
 * grain='free'       → siempre se puede rotar
 * grain='horizontal' → la dimensión larga es el ancho → se puede rotar si el alto > ancho
 *                      (la veta sigue siendo horizontal después de rotar)
 * grain='vertical'   → la dimensión larga es el alto → NO se puede rotar sin cambiar veta
 *
 * Regla práctica de carpintería:
 *   horizontal: la veta corre a lo ancho → piezas tipo tapa/base/frente
 *   vertical:   la veta corre a lo alto  → piezas tipo lateral
 *   free:       sin veta (fondos, cajas de cajón en 3mm/15mm)
 */
function canRotate(piece: ExpandedPiece): boolean {
  if (piece.grain === 'free') return true;
  // Con veta definida: solo se puede rotar si el resultado mantiene la orientación de veta
  // En la práctica para guillotina 2D: permitimos rotar solo piezas 'free'
  // Las piezas con veta definida nunca se rotan (podría cambiar dirección de fibra)
  return false;
}

// ─────────────────────────────────────────────────────────────
// ALGORITMO GUILLOTINA CON SPLIT ADAPTATIVO
// ─────────────────────────────────────────────────────────────

/**
 * Intenta colocar una pieza en el primer rectángulo libre donde entre.
 * Si no entra en orientación normal, intenta rotada (si grain lo permite).
 * El split elige la orientación que maximiza el área del rectángulo mayor resultante.
 */
function placePiece(
  freeRects: FreeRect[],
  placements: PlacedPiece[],
  piece: ExpandedPiece,
  kerf: number
): boolean {
  // Intentar primero sin rotar, luego rotado si está permitido
  const attempts: { w: number; h: number; rotated: boolean }[] = [
    { w: piece.width,  h: piece.height, rotated: false },
  ];
  if (canRotate(piece)) {
    attempts.push({ w: piece.height, h: piece.width, rotated: true });
  }

  for (const attempt of attempts) {
    for (let i = 0; i < freeRects.length; i++) {
      const r = freeRects[i];
      if (attempt.w <= r.w && attempt.h <= r.h) {
        // Colocar la pieza
        placements.push({
          id:      piece.id,
          label:   piece.label,
          x:       r.x,
          y:       r.y,
          width:   attempt.w,
          height:  attempt.h,
          rotated: attempt.rotated,
        });

        // Calcular los dos rectángulos resultantes del split guillotina
        const rightRect: FreeRect = {
          x: r.x + attempt.w + kerf,
          y: r.y,
          w: r.w - attempt.w - kerf,
          h: attempt.h,
        };
        const belowRect: FreeRect = {
          x: r.x,
          y: r.y + attempt.h + kerf,
          w: r.w,
          h: r.h - attempt.h - kerf,
        };

        // Split adaptativo: elige la orientación que deja el rectángulo mayor
        // Opción A: derecho pequeño + abajo grande
        // Opción B: derecho alto + abajo ancho
        // → comparar áreas del rect más grande de cada opción
        const areaRightA = rightRect.w > 0 && rightRect.h > 0 ? rightRect.w * rightRect.h : 0;
        const areaBelowA = belowRect.w > 0 && belowRect.h > 0 ? belowRect.w * belowRect.h : 0;

        // Opción B: split horizontal primero
        const rightRectB: FreeRect = {
          x: r.x + attempt.w + kerf,
          y: r.y,
          w: r.w - attempt.w - kerf,
          h: r.h,  // ← toda la altura
        };
        const belowRectB: FreeRect = {
          x: r.x,
          y: r.y + attempt.h + kerf,
          w: attempt.w,  // ← solo el ancho de la pieza
          h: r.h - attempt.h - kerf,
        };
        const areaRightB = rightRectB.w > 0 && rightRectB.h > 0 ? rightRectB.w * rightRectB.h : 0;
        const areaBelowB = belowRectB.w > 0 && belowRectB.h > 0 ? belowRectB.w * belowRectB.h : 0;

        // Usar la opción que maximiza el rectángulo mayor (más aprovechable)
        const maxA = Math.max(areaRightA, areaBelowA);
        const maxB = Math.max(areaRightB, areaBelowB);

        freeRects.splice(i, 1);

        if (maxB > maxA) {
          if (rightRectB.w > 0 && rightRectB.h > 0) freeRects.push(rightRectB);
          if (belowRectB.w > 0 && belowRectB.h > 0) freeRects.push(belowRectB);
        } else {
          if (rightRect.w > 0 && rightRect.h > 0) freeRects.push(rightRect);
          if (belowRect.w > 0 && belowRect.h > 0) freeRects.push(belowRect);
        }

        return true;
      }
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function generateCutPlan(input: Input): CutPlanResult {
  const { sheetWidth, sheetHeight, kerf } = input;

  // 1. Expandir piezas (quantity > 1 → múltiples instancias)
  const expanded: ExpandedPiece[] = [];
  input.pieces.forEach(p => {
    for (let i = 0; i < p.quantity; i++) {
      expanded.push({
        id:     `${p.id}_${i}`,
        label:  p.label || p.id,
        width:  Math.round(p.width),
        height: Math.round(p.height),
        grain:  p.grain || 'free',
        area:   p.width * p.height,
      });
    }
  });

  // 2. Separar piezas que no entran en ninguna orientación
  const unplaceable: CutPlanResult['unplaceable'] = [];
  const placeable: ExpandedPiece[] = [];

  expanded.forEach(p => {
    const fitsNormal  = p.width  <= sheetWidth && p.height <= sheetHeight;
    const fitsRotated = p.height <= sheetWidth && p.width  <= sheetHeight;
    const couldRotate = canRotate(p);

    if (fitsNormal || (fitsRotated && couldRotate)) {
      placeable.push(p);
    } else if (fitsRotated && !couldRotate) {
      // Entraría rotada pero la veta no lo permite → reportar como error
      unplaceable.push({
        id:     p.id,
        label:  p.label,
        reason: `La pieza (${p.width}×${p.height}mm) requiere rotación pero tiene veta definida. Verificar dimensiones o cambiar placa.`,
      });
    } else {
      unplaceable.push({
        id:     p.id,
        label:  p.label,
        reason: `La pieza (${p.width}×${p.height}mm) excede las dimensiones de la placa (${sheetWidth}×${sheetHeight}mm).`,
      });
    }
  });

  // 3. Ordenar por área descendente (First Fit Decreasing)
  placeable.sort((a, b) => b.area - a.area);

  // 4. Colocar piezas en placas
  const sheets: { placements: PlacedPiece[]; freeRects: FreeRect[] }[] = [];

  for (const piece of placeable) {
    let placed = false;

    // Intentar en placas existentes
    for (const sheet of sheets) {
      if (placePiece(sheet.freeRects, sheet.placements, piece, kerf)) {
        placed = true;
        break;
      }
    }

    // Abrir nueva placa
    if (!placed) {
      const newSheet = {
        placements: [] as PlacedPiece[],
        freeRects:  [{ x: 0, y: 0, w: sheetWidth, h: sheetHeight }] as FreeRect[],
      };
      placePiece(newSheet.freeRects, newSheet.placements, piece, kerf);
      sheets.push(newSheet);
    }
  }

  // 5. Calcular eficiencia por placa
  const totalSheetArea = sheetWidth * sheetHeight;
  const result: Sheet[] = sheets.map(s => {
    const usedArea = s.placements.reduce((acc, p) => acc + p.width * p.height, 0);
    return {
      width:      sheetWidth,
      height:     sheetHeight,
      placements: s.placements,
      freeRects:  s.freeRects,
      efficiency: Math.round((usedArea / totalSheetArea) * 100),
    };
  });

  return { sheets: result, unplaceable };
}
