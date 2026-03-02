
export interface Piece {
  id: string;
  width: number;
  height: number;
  quantity: number;
}

export interface Input {
  pieces: Piece[];
  sheetWidth: number;
  sheetHeight: number;
  kerf: number;
}

export interface PlacedPiece {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Sheet {
  width: number;
  height: number;
  freeRects: { x: number; y: number; w: number; h: number }[];
  placements: PlacedPiece[];
}

class SheetClass implements Sheet {
  width: number;
  height: number;
  freeRects: { x: number; y: number; w: number; h: number }[];
  placements: PlacedPiece[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
    this.placements = [];
  }
}

function placePiece(sheet: Sheet, piece: { id: string, width: number, height: number }, kerf: number): boolean {
  for (let i = 0; i < sheet.freeRects.length; i++) {
    let r = sheet.freeRects[i];

    if (piece.width <= r.w && piece.height <= r.h) {

      sheet.placements.push({
        id: piece.id,
        x: r.x,
        y: r.y,
        width: piece.width,
        height: piece.height
      });

      // Remove the used rectangle
      sheet.freeRects.splice(i, 1);

      // Split the remaining space (Guillotine cut / MaxRects heuristic)
      // Add new free rect to the right
      sheet.freeRects.push({
        x: r.x + piece.width + kerf,
        y: r.y,
        w: r.w - piece.width - kerf,
        h: piece.height
      });

      // Add new free rect below
      sheet.freeRects.push({
        x: r.x,
        y: r.y + piece.height + kerf,
        w: r.w,
        h: r.h - piece.height - kerf
      });

      return true;
    }
  }
  return false;
}

function optimize(pieces: { id: string, width: number, height: number }[], sheetWidth: number, sheetHeight: number, kerf: number): Sheet[] {
  // Sort by area descending
  pieces.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  let sheets: Sheet[] = [];

  for (let p = 0; p < pieces.length; p++) {
    let piece = pieces[p];
    let placed = false;

    // Try to place in existing sheets
    for (let s = 0; s < sheets.length; s++) {
      if (placePiece(sheets[s], piece, kerf)) {
        placed = true;
        break;
      }
    }

    // If not placed, create new sheet
    if (!placed) {
      let newSheet = new SheetClass(sheetWidth, sheetHeight);
      placePiece(newSheet, piece, kerf);
      sheets.push(newSheet);
    }
  }

  return sheets;
}

export function generateCutPlan(input: Input): { sheets: Sheet[] } {
  let expandedPieces: { id: string, width: number, height: number }[] = [];

  input.pieces.forEach(p => {
    for (let i = 0; i < p.quantity; i++) {
      expandedPieces.push({
        id: p.id + "_" + i,
        width: p.width,
        height: p.height
      });
    }
  });

  let sheets = optimize(expandedPieces, input.sheetWidth, input.sheetHeight, input.kerf);

  return {
    sheets: sheets
  };
}
