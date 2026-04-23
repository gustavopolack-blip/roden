import { CalculatedPart } from '../types';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface SpecialModuleParams {
  width: number;   // mm
  height: number;  // mm
  depth: number;   // mm
}

export interface SpecialHardware {
  slides?: number;
  slideLength?: number;
  slideType?: string;
}

export interface SpecialModuleResult {
  parts: CalculatedPart[];
  hardware: SpecialHardware;
  laborDays: number;
}

export interface ManualItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export type SpecialModuleExtraOption =
  | { key: string; label: string; type: 'select';  options: { label: string; value: string }[] }
  | { key: string; label: string; type: 'number';  min?: number; max?: number; defaultValue?: number };

export interface SpecialModuleTemplate {
  id: string;
  name: string;
  description: string;
  params: Array<'width' | 'height' | 'depth'>;
  extraOptions?: SpecialModuleExtraOption[];
  calculate: (params: SpecialModuleParams, options?: Record<string, string>) => SpecialModuleResult;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const getSlideLength = (depth: number): number => {
  if (depth < 400) return 300;
  if (depth < 500) return 400;
  return 500;
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 1 — BOTINERO CON EXTRAÍBLES
// Bandejas extraíbles con guías telescópicas, 1 cada 200mm de alto
// ─────────────────────────────────────────────────────────────

const BOTINERO_EXTRAIBLE: SpecialModuleTemplate = {
  id: 'BOTINERO_EXTRAIBLE',
  name: 'Botinero c/ Extraíbles',
  description: 'Bandejas extraíbles con guías telescópicas (1 cada 20cm de altura)',
  params: ['width', 'height', 'depth'],
  calculate: ({ width: W, height: H, depth: D }) => {
    const parts: CalculatedPart[] = [];
    const bandejas = Math.floor(H / 200);

    // Cuerpo
    parts.push({ name: 'Tapa superior',   width: W,                    height: D,                   material: '18mm_Carcass', quantity: 1,       grain: 'horizontal' });
    parts.push({ name: 'Base inferior',   width: W,                    height: D,                   material: '18mm_Carcass', quantity: 1,       grain: 'horizontal' });
    parts.push({ name: 'Lateral',         width: D,                    height: H,                   material: '18mm_Carcass', quantity: 2,       grain: 'vertical'   });
    parts.push({ name: 'Fondo 3mm',       width: Math.max(0, W - 36),  height: Math.max(0, H - 38), material: '3mm_White',    quantity: 1,       grain: 'vertical'   });

    // Bandejas extraíbles
    if (bandejas > 0) {
      parts.push({
        name: `Bandeja extraíble (×${bandejas})`,
        width:    Math.max(0, W - 36),
        height:   Math.max(0, D - 45),
        material: '18mm_Carcass',
        quantity: bandejas,
        grain:    'horizontal'
      });
    }

    return {
      parts,
      hardware: {
        slides:      bandejas,
        slideLength: getSlideLength(D),
        slideType:   'TELESCOPIC'
      },
      laborDays: 0.5 + bandejas * 0.08
    };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 2 — BOTINERO CON BANDEJAS FIJAS INCLINADAS
// Bandejas fijas a 30°, con frentín de 5cm, 1 cada 200mm de alto
// ─────────────────────────────────────────────────────────────

const BOTINERO_FIJO: SpecialModuleTemplate = {
  id: 'BOTINERO_FIJO',
  name: 'Botinero c/ Bandejas Fijas',
  description: 'Bandejas fijas inclinadas 30° con frentín de 5cm (1 cada 20cm de altura)',
  params: ['width', 'height', 'depth'],
  calculate: ({ width: W, height: H, depth: D }) => {
    const parts: CalculatedPart[] = [];
    const bandejas = Math.floor(H / 200);

    // Cuerpo
    parts.push({ name: 'Tapa superior',   width: W,                    height: D,                   material: '18mm_Carcass', quantity: 1,       grain: 'horizontal' });
    parts.push({ name: 'Base inferior',   width: W,                    height: D,                   material: '18mm_Carcass', quantity: 1,       grain: 'horizontal' });
    parts.push({ name: 'Lateral',         width: D,                    height: H,                   material: '18mm_Carcass', quantity: 2,       grain: 'vertical'   });
    parts.push({ name: 'Fondo 3mm',       width: Math.max(0, W - 36),  height: Math.max(0, H - 38), material: '3mm_White',    quantity: 1,       grain: 'vertical'   });

    // Bandejas fijas inclinadas + frentín
    if (bandejas > 0) {
      parts.push({
        name: `Bandeja fija inclinada (×${bandejas})`,
        width:    Math.max(0, W - 36),
        height:   Math.max(0, D - 45),
        material: '18mm_Carcass',
        quantity: bandejas,
        grain:    'horizontal'
      });
      parts.push({
        name: `Frentín bandeja 50mm (×${bandejas})`,
        width:    Math.max(0, W - 36),
        height:   50,
        material: '18mm_Front',
        quantity: bandejas,
        grain:    'horizontal'
      });
    }

    return {
      parts,
      hardware: {},  // Sin guías
      laborDays: 0.5 + bandejas * 0.06
    };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 3 — BIBLIOTECA
// Estantes fijos 1 cada 320mm de alto
// ─────────────────────────────────────────────────────────────

const BIBLIOTECA: SpecialModuleTemplate = {
  id: 'BIBLIOTECA',
  name: 'Biblioteca',
  description: 'Estantes fijos (1 cada 32cm de altura)',
  params: ['width', 'height', 'depth'],
  calculate: ({ width: W, height: H, depth: D }) => {
    const parts: CalculatedPart[] = [];
    const estantes = Math.floor(H / 320);

    // Cuerpo
    parts.push({ name: 'Tapa superior',   width: W,                    height: D,                   material: '18mm_Carcass', quantity: 1,       grain: 'horizontal' });
    parts.push({ name: 'Base inferior',   width: W,                    height: D,                   material: '18mm_Carcass', quantity: 1,       grain: 'horizontal' });
    parts.push({ name: 'Lateral',         width: D,                    height: H,                   material: '18mm_Carcass', quantity: 2,       grain: 'vertical'   });
    parts.push({ name: 'Fondo 3mm',       width: Math.max(0, W - 36),  height: Math.max(0, H - 38), material: '3mm_White',    quantity: 1,       grain: 'vertical'   });

    // Estantes
    if (estantes > 0) {
      parts.push({
        name: `Estante fijo (×${estantes})`,
        width:    Math.max(0, W - 36),
        height:   Math.max(0, D - 45),
        material: '18mm_Carcass',
        quantity: estantes,
        grain:    'horizontal'
      });
    }

    return {
      parts,
      hardware: {},
      laborDays: 0.5 + estantes * 0.04
    };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 4 — PANEL LISO
// Placa 18mm + bastidor trasero (marco retirado 5cm del perímetro)
// ─────────────────────────────────────────────────────────────

const PANEL_LISO: SpecialModuleTemplate = {
  id: 'PANEL_LISO',
  name: 'Panel de Revestimiento Liso',
  description: 'Placa 18mm con bastidor trasero de 5cm retirado del perímetro',
  params: ['width', 'height'],
  calculate: ({ width: W, height: H }) => {
    const parts: CalculatedPart[] = [];
    const RET = 50; // retiro del perímetro en mm

    // Placa frontal
    parts.push({
      name:     'Panel frontal 18mm',
      width:    W,
      height:   H,
      material: '18mm_Front',
      quantity: 1,
      grain:    'vertical'
    });

    // Bastidor trasero: 4 listones de 18mm × 50mm
    // 2 horizontales (ancho total - 2 retiros) × 50mm
    // 2 verticales   (alto total - 2 retiros)  × 50mm
    const bastidorH_width  = Math.max(0, W - RET * 2);
    const bastidorV_height = Math.max(0, H - RET * 2);

    parts.push({
      name:     'Bastidor horizontal',
      width:    bastidorH_width,
      height:   50,
      material: '18mm_Carcass',
      quantity: 2,
      grain:    'horizontal'
    });
    parts.push({
      name:     'Bastidor vertical',
      width:    50,
      height:   bastidorV_height,
      material: '18mm_Carcass',
      quantity: 2,
      grain:    'vertical'
    });

    return {
      parts,
      hardware: {},
      laborDays: 0.3
    };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 5 — PANEL ENLISTONADO
// Placa 18mm base + listones 18×18mm superpuestos, separados 18mm entre sí
// ─────────────────────────────────────────────────────────────

const PANEL_ENLISTONADO: SpecialModuleTemplate = {
  id: 'PANEL_ENLISTONADO',
  name: 'Panel de Revestimiento Enlistonado',
  description: 'Placa 18mm base + listones 18×18mm cada 36mm (listón + separación)',
  params: ['width', 'height'],
  extraOptions: [
    {
      key: 'orientation',
      label: 'Orientación de listones',
      type: 'select',
      options: [
        { label: 'Vertical',   value: 'vertical'   },
        { label: 'Horizontal', value: 'horizontal' }
      ]
    }
  ],
  calculate: ({ width: W, height: H }, options = {}) => {
    const parts: CalculatedPart[] = [];
    const orientation = options.orientation || 'vertical';

    // Placa base
    parts.push({
      name:     'Panel base 18mm',
      width:    W,
      height:   H,
      material: '18mm_Carcass',
      quantity: 1,
      grain:    'vertical'
    });

    // Listones 18×18mm
    // Paso = 18mm (listón) + 18mm (separación) = 36mm
    // Cantidad = floor(dimensión_principal / 36)
    const STEP    = 36; // mm
    const LISTONW = 18; // mm ancho del listón
    const LISTONH = 18; // mm espesor del listón

    if (orientation === 'vertical') {
      const cantidad = Math.floor(W / STEP);
      parts.push({
        name:     `Listón vertical 18×18mm (×${cantidad})`,
        width:    LISTONW,
        height:   H,
        material: '18mm_Front',
        quantity: cantidad,
        grain:    'vertical'
      });
    } else {
      const cantidad = Math.floor(H / STEP);
      parts.push({
        name:     `Listón horizontal 18×18mm (×${cantidad})`,
        width:    W,
        height:   LISTONH,
        material: '18mm_Front',
        quantity: cantidad,
        grain:    'horizontal'
      });
    }

    return {
      parts,
      hardware: {},
      laborDays: 0.4 + Math.floor((orientation === 'vertical' ? W : H) / STEP) * 0.02
    };
  }
};


// ─────────────────────────────────────────────────────────────
// TEMPLATE 6 — MÓDULO ABIERTO
// Sin frentes. Fondo = mismo material que estructura (18mm)
// salvo que se elija fondo blanco 3mm o fondo color 5.5mm
// ─────────────────────────────────────────────────────────────

const MODULO_ABIERTO: SpecialModuleTemplate = {
  id: 'MODULO_ABIERTO',
  name: 'Módulo Abierto',
  description: 'Sin frentes. Laterales, piso, techo y fondo (18mm estructura, o fondo 3mm/5.5mm)',
  params: ['width', 'height', 'depth'],
  extraOptions: [
    {
      key: 'backingType',
      label: 'Tipo de fondo',
      type: 'select',
      options: [
        { label: 'Fondo 18mm (igual a estructura)', value: '18MM_STRUCTURE' },
        { label: 'Fondo blanco 3mm',                value: '3MM_WHITE'      },
        { label: 'Fondo color 5.5mm',               value: '55_COLOR'       },
      ]
    }
  ],
  calculate: ({ width: W, height: H, depth: D }, options = {}) => {
    const parts: CalculatedPart[] = [];
    const backingType = options.backingType || '18MM_STRUCTURE';

    // Laterales: si fondo es 5.5mm o 18mm, lateral se acorta 18mm en profundidad
    const lateralDepth = (backingType === '55_COLOR' || backingType === '18MM_STRUCTURE') ? D - 18 : D;

    parts.push({ name: 'Tapa superior',  width: W,                   height: D,                   material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Base inferior',  width: W,                   height: D,                   material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Lateral',        width: lateralDepth,        height: H,                   material: '18mm_Carcass', quantity: 2, grain: 'vertical'   });

    // Fondo según tipo
    if (backingType === '3MM_WHITE') {
      parts.push({ name: 'Fondo 3mm Blanco', width: Math.max(0, W - 36), height: Math.max(0, H - 38), material: '3mm_White',    quantity: 1, grain: 'vertical' });
    } else if (backingType === '55_COLOR') {
      parts.push({ name: 'Fondo 5.5mm Color', width: Math.max(0, W - 36), height: Math.max(0, H - 18), material: '5.5mm_Color',  quantity: 1, grain: 'vertical' });
    } else {
      // 18MM_STRUCTURE — fondo del mismo material que la estructura
      parts.push({ name: 'Fondo 18mm Estructura', width: Math.max(0, W - 36), height: Math.max(0, H - 18), material: '18mm_Carcass', quantity: 1, grain: 'vertical' });
    }

    // Estantes internos automáticos (1 cada 350mm sobre los 850mm base)
    let estantes = 0;
    if (H > 850) estantes = Math.floor((H - 850) / 350) + 1;
    if (estantes > 0) {
      parts.push({ name: 'Estante interno', width: Math.max(0, W - 36), height: Math.max(0, D - 45), material: '18mm_Carcass', quantity: estantes, grain: 'horizontal' });
    }

    return {
      parts,
      hardware: {},
      laborDays: 0.4 + estantes * 0.04
    };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 7 — ESTANTE FLOTANTE
// Espesor fijo 36mm = 2 × 18mm. Solo requiere ancho y profundidad.
// ─────────────────────────────────────────────────────────────

const ESTANTE_FLOTANTE: SpecialModuleTemplate = {
  id: 'ESTANTE_FLOTANTE',
  name: 'Estante Flotante',
  description: 'Estante mural 36mm — dos placas 18mm superpuestas. Solo ancho y profundidad.',
  params: ['width', 'depth'],   // height no aplica: espesor fijo 36mm
  calculate: ({ width: W, depth: D }) => {
    const parts: CalculatedPart[] = [];

    // Estante 36mm = 2 placas de 18mm superpuestas
    parts.push({
      name:     'Estante — cara superior',
      width:    W,
      height:   D,
      material: '18mm_Carcass',
      quantity: 1,
      grain:    'horizontal'
    });
    parts.push({
      name:     'Estante — cara inferior',
      width:    W,
      height:   D,
      material: '18mm_Carcass',
      quantity: 1,
      grain:    'horizontal'
    });

    return {
      parts,
      hardware: {},
      laborDays: 0.15
    };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 8 — MÓDULO HORIZONTAL
// Medidas exteriores totales.
// El usuario elige tipo de frente (puertas o cajones) y cantidad.
// Divisores internos = cantidad - 1, cada uno a (innerW / cantidad) de claro.
// Cajones: caja interior en melamina blanca 15mm.
// ─────────────────────────────────────────────────────────────

const MODULO_HORIZONTAL: SpecialModuleTemplate = {
  id: 'MODULO_HORIZONTAL',
  name: 'Módulo Horizontal',
  description: 'Módulo bajo: puertas o cajones. Divisores = cantidad − 1. Cajones en mel. blanca 15mm.',
  params: ['width', 'height', 'depth'],
  extraOptions: [
    {
      key: 'frontType',
      label: 'Tipo de frente',
      type: 'select',
      options: [
        { label: 'Puertas abatibles', value: 'DOORS'   },
        { label: 'Cajones',           value: 'DRAWERS' },
      ]
    },
    {
      key: 'numPanels',
      label: 'Cantidad',
      type: 'number',
      min:          1,
      max:          8,
      defaultValue: 2,
    },
  ],
  calculate: ({ width: W, height: H, depth: D }, options = {}) => {
    const parts: CalculatedPart[] = [];
    const frontType  = options.frontType || 'DOORS';
    const numPanels  = Math.max(1, parseInt(options.numPanels || '2', 10));
    const numDividers = numPanels - 1;

    // ── Medidas interiores ───────────────────────────────────
    // Tapa/base = ancho total. Laterales = H exterior × D exterior.
    // innerW = W - 2×18mm (laterales). innerH = H - 2×18mm (tapa+base).
    // innerD = D - 18mm (fondo 3mm entra en ranura; lateral compacto).
    const innerW      = Math.max(0, W - 36);
    const innerH      = Math.max(0, H - 36);
    const innerD      = Math.max(0, D - 18);
    // Ancho de claro por panel (entre divisores / entre lateral y divisor)
    const clearW      = Math.round(innerW / numPanels);

    // ── Cuerpo exterior ──────────────────────────────────────
    parts.push({ name: 'Tapa superior', width: W,      height: D,                   material: '18mm_Carcass', quantity: 1,          grain: 'horizontal' });
    parts.push({ name: 'Base inferior', width: W,      height: D,                   material: '18mm_Carcass', quantity: 1,          grain: 'horizontal' });
    parts.push({ name: 'Lateral',       width: D,      height: H,                   material: '18mm_Carcass', quantity: 2,          grain: 'vertical'   });
    parts.push({ name: 'Fondo 3mm',     width: innerW, height: Math.max(0, H - 38), material: '3mm_White',    quantity: 1,          grain: 'vertical'   });

    // ── Divisores internos ───────────────────────────────────
    // Van de tapa a base (altura = innerH), profundidad = innerD
    if (numDividers > 0) {
      parts.push({
        name:     `Divisor vertical (×${numDividers})`,
        width:    innerD,
        height:   innerH,
        material: '18mm_Carcass',
        quantity: numDividers,
        grain:    'vertical'
      });
    }

    let laborDays = 0.5 + numDividers * 0.08;

    if (frontType === 'DOORS') {
      // ── Puertas abatibles ──────────────────────────────────
      // Una hoja por panel, ancho = clearW, alto = H exterior
      parts.push({
        name:     `Puerta abatible (×${numPanels})`,
        width:    clearW,
        height:   H,
        material: '18mm_Front',
        quantity: numPanels,
        grain:    'vertical'
      });
      laborDays += numPanels * 0.12;

    } else {
      // ── Cajones (caja en melamina blanca 15mm) ─────────────
      // Cada "cajón" ocupa un panel de ancho clearW y la altura interior total (un cajón por columna).
      // La caja se construye con 15mm_White.
      // Lateral caja: profundidad = D - 20mm (espacio para carros), alto = innerH - 10mm (juego)
      // Testa caja (frente + trasero): ancho = clearW - 30mm (2 × 15mm lat), alto = innerH - 10mm
      // Fondo caja 3mm: ancho = clearW - 30mm, profundidad = D - 20mm
      // Frente exterior visible (18mm_Front): clearW × H

      const boxDepth  = Math.max(80, D - 20);        // profundidad de la caja interior
      const boxHeight = Math.max(50, innerH - 10);    // alto de la caja
      const boxInnerW = Math.max(0, clearW - 30);     // ancho interior de la caja (clearW - 2×15mm)

      parts.push({
        name:     `Lateral caja cajón 15mm (×${numPanels * 2})`,
        width:    boxDepth,
        height:   boxHeight,
        material: '15mm_White',
        quantity: numPanels * 2,
        grain:    'horizontal'
      });
      parts.push({
        name:     `Testa cajón 15mm — frente+trasero (×${numPanels * 2})`,
        width:    boxInnerW,
        height:   boxHeight,
        material: '15mm_White',
        quantity: numPanels * 2,
        grain:    'horizontal'
      });
      parts.push({
        name:     `Fondo caja cajón 3mm (×${numPanels})`,
        width:    boxInnerW,
        height:   boxDepth,
        material: '3mm_White',
        quantity: numPanels,
        grain:    'horizontal'
      });

      // Frente exterior visible (cuelga del frente, tapa el interior)
      parts.push({
        name:     `Frente exterior cajón (×${numPanels})`,
        width:    clearW,
        height:   H,
        material: '18mm_Front',
        quantity: numPanels,
        grain:    'vertical'
      });

      laborDays += numPanels * 0.22;
    }

    return {
      parts,
      hardware: {},
      laborDays
    };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 9 — TAPA HORIZONTAL
// Placa 18mm (simple) o regrueso 36mm (2 × 18mm superpuestas).
// ─────────────────────────────────────────────────────────────

const TAPA_HORIZONTAL: SpecialModuleTemplate = {
  id: 'TAPA_HORIZONTAL',
  name: 'Tapa Horizontal',
  description: 'Placa 18mm. Con regrueso: agrega faja perimetral 50mm (total 36mm de espesor).',
  params: ['width', 'depth'],
  extraOptions: [
    {
      key: 'espesor',
      label: 'Espesor',
      type: 'select',
      options: [
        { label: '18mm (simple)',          value: '18mm' },
        { label: 'Regrueso 36mm (+ faja)', value: '36mm' },
      ]
    }
  ],
  calculate: ({ width: W, depth: D }, options = {}) => {
    const espesor = options.espesor || '18mm';
    const parts: CalculatedPart[] = [];

    // Placa principal (siempre 18mm)
    parts.push({
      name:     'Tapa horizontal 18mm',
      width:    W,
      height:   D,
      material: '18mm_Carcass',
      quantity: 1,
      grain:    'horizontal'
    });

    if (espesor === '36mm') {
      // Faja perimetral 50mm pegada al canto para llegar a 36mm de espesor total
      // 2 fajas largas (a lo ancho)
      parts.push({
        name:     'Faja regrueso — largo (×2)',
        width:    W,
        height:   50,
        material: '18mm_Carcass',
        quantity: 2,
        grain:    'horizontal'
      });
      // 2 fajas cortas (a lo profundo, entre las largas)
      const fajaCortaH = Math.max(0, D - 100);
      parts.push({
        name:     'Faja regrueso — profundidad (×2)',
        width:    fajaCortaH,
        height:   50,
        material: '18mm_Carcass',
        quantity: 2,
        grain:    'horizontal'
      });
    }

    return { parts, hardware: {}, laborDays: espesor === '36mm' ? 0.2 : 0.1 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 10 — DIVISOR VERTICAL
// Placa 18mm. Solo alto y profundidad.
// ─────────────────────────────────────────────────────────────

const DIVISOR_VERTICAL: SpecialModuleTemplate = {
  id: 'DIVISOR_VERTICAL',
  name: 'Divisor Vertical',
  description: 'Placa vertical 18mm interior — solo alto y profundidad.',
  params: ['height', 'depth'],
  calculate: ({ height: H, depth: D }) => {
    const parts: CalculatedPart[] = [];

    parts.push({
      name:     'Divisor vertical 18mm',
      width:    D,
      height:   H,
      material: '18mm_Carcass',
      quantity: 1,
      grain:    'vertical'
    });

    return { parts, hardware: {}, laborDays: 0.05 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 11 — LATERAL APLICADO
// Placa 18mm aplicada sobre el costado de un módulo. Solo alto y profundidad.
// ─────────────────────────────────────────────────────────────

const LATERAL_APLICADO: SpecialModuleTemplate = {
  id: 'LATERAL_APLICADO',
  name: 'Lateral Aplicado',
  description: 'Lateral 18mm aplicado sobre el costado de un módulo existente.',
  params: ['height', 'depth'],
  calculate: ({ height: H, depth: D }) => {
    const parts: CalculatedPart[] = [];

    parts.push({
      name:     'Lateral aplicado 18mm',
      width:    D,
      height:   H,
      material: '18mm_Carcass',
      quantity: 1,
      grain:    'vertical'
    });

    return { parts, hardware: {}, laborDays: 0.05 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 12 — AJUSTE
// Placa 18mm. Profundidad fija 100mm. Solo largo (ancho).
// Orientación visual: vertical u horizontal.
// ─────────────────────────────────────────────────────────────

const AJUSTE: SpecialModuleTemplate = {
  id: 'AJUSTE',
  name: 'Ajuste',
  description: 'Placa 18mm × 100mm (ancho fijo). Solo se ingresa el largo.',
  params: ['width'],
  calculate: ({ width: W }) => {
    const parts: CalculatedPart[] = [];

    parts.push({
      name:     'Ajuste 18mm × 100mm',
      width:    W,
      height:   100,
      material: '18mm_Carcass',
      quantity: 1,
      grain:    'vertical'
    });

    return { parts, hardware: {}, laborDays: 0.05 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 13 — MÓDULO BAJO MESADA
// Sin tapa. Laterales + piso + fajas + fondo 3mm en ranuras.
// Interior: estante regulable o cajones.
// ─────────────────────────────────────────────────────────────

const MODULO_BAJO_MESADA: SpecialModuleTemplate = {
  id: 'MODULO_BAJO_MESADA',
  name: 'Módulo Bajo Mesada',
  description: 'Sin tapa. Laterales, piso, faja frontal y trasera (100mm), fondo 3mm en ranuras.',
  params: ['width', 'height', 'depth'],
  extraOptions: [
    {
      key: 'interior',
      label: 'Interior',
      type: 'select',
      options: [
        { label: 'Estante regulable', value: 'ESTANTE'  },
        { label: 'Cajones',           value: 'CAJONES'  },
      ]
    }
  ],
  calculate: ({ width: W, height: H, depth: D }, options = {}) => {
    const interior = options.interior || 'ESTANTE';
    const parts: CalculatedPart[] = [];

    const innerW = Math.max(0, W - 36);

    // Estructura
    parts.push({ name: 'Lateral',       width: D,      height: H,                             material: '18mm_Carcass', quantity: 2, grain: 'vertical'   });
    parts.push({ name: 'Piso',          width: innerW, height: D,                             material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Faja frontal',  width: innerW, height: 100,                           material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Faja trasera',  width: innerW, height: 100,                           material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Fondo 3mm',     width: innerW, height: Math.max(0, H - 100 - 10),    material: '3mm_White',    quantity: 1, grain: 'vertical'   });

    let laborDays = 0.5;

    if (interior === 'ESTANTE') {
      parts.push({
        name:     'Estante regulable',
        width:    innerW,
        height:   Math.max(0, D - 45),
        material: '18mm_Carcass',
        quantity: 1,
        grain:    'horizontal'
      });
      laborDays += 0.05;

    } else {
      // Cajones: 1 cada ~180mm de altura interior disponible
      const innerH    = Math.max(180, H - 100 - 18);
      const cntDrawers = Math.max(1, Math.floor(innerH / 180));
      const boxHeight  = Math.max(50, Math.floor(innerH / cntDrawers) - 10);
      const boxDepth   = Math.max(80, D - 20);
      const boxInnerW  = Math.max(0, innerW - 30);

      parts.push({ name: `Lateral caja cajón 15mm (×${cntDrawers * 2})`, width: boxDepth,  height: boxHeight,                         material: '15mm_White',   quantity: cntDrawers * 2, grain: 'horizontal' });
      parts.push({ name: `Testa cajón 15mm (×${cntDrawers * 2})`,        width: boxInnerW, height: boxHeight,                         material: '15mm_White',   quantity: cntDrawers * 2, grain: 'horizontal' });
      parts.push({ name: `Fondo caja cajón 3mm (×${cntDrawers})`,        width: boxInnerW, height: boxDepth,                          material: '3mm_White',    quantity: cntDrawers,     grain: 'horizontal' });
      parts.push({ name: `Frente exterior cajón (×${cntDrawers})`,       width: innerW,    height: Math.floor(H / cntDrawers),        material: '18mm_Front',   quantity: cntDrawers,     grain: 'vertical'   });
      laborDays += cntDrawers * 0.22;
    }

    return { parts, hardware: {}, laborDays };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 14 — ESQUINERO
// Bajo mesada para rincón. Panel fijo 620mm + puerta = total − 620 − 4mm.
// ─────────────────────────────────────────────────────────────

const ESQUINERO: SpecialModuleTemplate = {
  id: 'ESQUINERO',
  name: 'Esquinero',
  description: 'Bajo mesada para rincón. Panel fijo 620mm. Puerta = ancho − 620 − 4mm.',
  params: ['width', 'height', 'depth'],
  calculate: ({ width: W, height: H, depth: D }) => {
    const parts: CalculatedPart[] = [];

    const innerW = Math.max(0, W - 36);
    const doorW  = Math.max(0, W - 620 - 4);

    // Estructura (igual a bajo mesada)
    parts.push({ name: 'Lateral',       width: D,      height: H,                          material: '18mm_Carcass', quantity: 2, grain: 'vertical'   });
    parts.push({ name: 'Piso',          width: innerW, height: D,                          material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Faja frontal',  width: innerW, height: 100,                        material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Faja trasera',  width: innerW, height: 100,                        material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Fondo 3mm',     width: innerW, height: Math.max(0, H - 100 - 10), material: '3mm_White',    quantity: 1, grain: 'vertical'   });

    // Frentes
    parts.push({ name: 'Panel fijo 620mm', width: 620,   height: H, material: '18mm_Front', quantity: 1, grain: 'vertical' });
    if (doorW > 0) {
      parts.push({ name: 'Puerta esquinero', width: doorW, height: H, material: '18mm_Front', quantity: 1, grain: 'vertical' });
    }

    return { parts, hardware: {}, laborDays: 0.7 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 15 — ESQUINERO EN L
// Dos laterales de 560mm fijos. Dos brazos: largo1 (= ancho) y largo2.
// ─────────────────────────────────────────────────────────────

const ESQUINERO_EN_L: SpecialModuleTemplate = {
  id: 'ESQUINERO_EN_L',
  name: 'Esquinero en L',
  description: 'Módulo esquinero en L. Dos laterales fijos 560mm. Brazo 1 = ancho, Brazo 2 = largo2.',
  params: ['width', 'height', 'depth'],
  extraOptions: [
    {
      key:          'largo2',
      label:        'Largo brazo 2 (mm)',
      type:         'number',
      min:          300,
      max:          1200,
      defaultValue: 600
    }
  ],
  calculate: ({ width: W, height: H, depth: D }, options = {}) => {
    const largo2 = Math.max(300, parseInt(options.largo2 || '600', 10));
    const parts: CalculatedPart[] = [];

    // Dos laterales de esquina 560mm
    parts.push({ name: 'Lateral de esquina 560mm', width: 560, height: H, material: '18mm_Carcass', quantity: 2, grain: 'vertical' });

    // Brazo 1 (ancho = W)
    const arm1W = Math.max(0, W - 560 - 18);
    parts.push({ name: 'Piso brazo 1',        width: arm1W, height: D,                        material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Faja frontal brazo 1', width: arm1W, height: 100,                      material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Fondo 3mm brazo 1',   width: arm1W, height: Math.max(0, H - 110),     material: '3mm_White',    quantity: 1, grain: 'vertical'   });

    // Brazo 2 (largo2)
    const arm2W = Math.max(0, largo2 - 560 - 18);
    parts.push({ name: 'Piso brazo 2',        width: arm2W, height: D,                        material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Faja frontal brazo 2', width: arm2W, height: 100,                      material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Fondo 3mm brazo 2',   width: arm2W, height: Math.max(0, H - 110),     material: '3mm_White',    quantity: 1, grain: 'vertical'   });

    return { parts, hardware: {}, laborDays: 1.0 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 16 — ZÓCALO APLICADO
// Placa 18mm o 5.5mm. Solo largo y alto.
// ─────────────────────────────────────────────────────────────

const ZOCALO_APLICADO: SpecialModuleTemplate = {
  id: 'ZOCALO_APLICADO',
  name: 'Zócalo Aplicado',
  description: 'Revestimiento de zócalo 18mm o 5.5mm — solo largo y alto.',
  params: ['width', 'height'],
  extraOptions: [
    {
      key: 'espesor',
      label: 'Espesor',
      type: 'select',
      options: [
        { label: '18mm (melamina)', value: '18mm'  },
        { label: '5.5mm (fondo)',   value: '5.5mm' },
      ]
    }
  ],
  calculate: ({ width: W, height: H }, options = {}) => {
    const espesor = options.espesor || '18mm';
    const parts: CalculatedPart[] = [];

    parts.push({
      name:     `Zócalo aplicado ${espesor}`,
      width:    W,
      height:   H,
      material: espesor === '5.5mm' ? '5.5mm_Color' : '18mm_Carcass',
      quantity: 1,
      grain:    'horizontal'
    });

    return { parts, hardware: {}, laborDays: 0.1 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 17 — ZÓCALO ESTRUCTURAL
// Marco 18mm con refuerzos internos cada 500mm.
// ≤600mm → 0 refuerzos; +1 por cada 500mm adicionales.
// ─────────────────────────────────────────────────────────────

const ZOCALO_ESTRUCTURAL: SpecialModuleTemplate = {
  id: 'ZOCALO_ESTRUCTURAL',
  name: 'Zócalo Estructural',
  description: 'Marco 18mm con refuerzos internos cada 500mm (0 ≤600mm; +1 cada 500mm adicionales).',
  params: ['width', 'height', 'depth'],
  calculate: ({ width: W, height: H, depth: D }) => {
    const parts: CalculatedPart[] = [];

    const innerH       = Math.max(0, H - 36); // alto interior (H menos tapa y base)
    const cntRefuerzos = W > 600 ? Math.floor((W - 600) / 500) + 1 : 0;

    // Tapa + base
    parts.push({ name: 'Tapa',    width: W,      height: D,  material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    parts.push({ name: 'Base',    width: W,      height: D,  material: '18mm_Carcass', quantity: 1, grain: 'horizontal' });
    // Laterales
    parts.push({ name: 'Lateral', width: innerH, height: D,  material: '18mm_Carcass', quantity: 2, grain: 'vertical'   });

    if (cntRefuerzos > 0) {
      parts.push({
        name:     `Refuerzo interno (×${cntRefuerzos})`,
        width:    innerH,
        height:   D,
        material: '18mm_Carcass',
        quantity: cntRefuerzos,
        grain:    'vertical'
      });
    }

    return { parts, hardware: {}, laborDays: 0.2 + cntRefuerzos * 0.05 };
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATE 18 — ESPECIAL MANUAL
// Sin geometría calculada — el usuario ingresa piezas y costos libres
// ─────────────────────────────────────────────────────────────

export const SPECIAL_MANUAL_ID = 'ESPECIAL_MANUAL';

// No tiene template con calculate() — se maneja directamente
// en el formulario con la lista de ManualItem[]

// ─────────────────────────────────────────────────────────────
// REGISTRO DE TEMPLATES
// ─────────────────────────────────────────────────────────────

export const SPECIAL_MODULE_TEMPLATES: SpecialModuleTemplate[] = [
  // ── Módulos estructurales completos ──
  MODULO_ABIERTO,
  MODULO_HORIZONTAL,
  MODULO_BAJO_MESADA,
  ESQUINERO,
  ESQUINERO_EN_L,
  // ── Piezas sueltas / aplicados ──
  TAPA_HORIZONTAL,
  DIVISOR_VERTICAL,
  LATERAL_APLICADO,
  AJUSTE,
  ZOCALO_APLICADO,
  ZOCALO_ESTRUCTURAL,
  // ── Muebles especiales ──
  ESTANTE_FLOTANTE,
  BOTINERO_EXTRAIBLE,
  BOTINERO_FIJO,
  BIBLIOTECA,
  PANEL_LISO,
  PANEL_ENLISTONADO,
];

export const getTemplate = (id: string): SpecialModuleTemplate | undefined =>
  SPECIAL_MODULE_TEMPLATES.find(t => t.id === id);

// ─────────────────────────────────────────────────────────────
// COSTEO DE MÓDULO ESPECIAL
// Convierte las piezas del template en costo usando el snapshot de precios
// ─────────────────────────────────────────────────────────────

export interface SpecialModuleCostResult {
  costMaterials: number;
  costHardware:  number;
  costLabor:     number;
  totalDirectCost: number;
  parts: CalculatedPart[];
}

export const calculateSpecialModuleCost = (
  result: SpecialModuleResult,
  snapshot: any,  // CostSnapshot
  slideType: string = 'TELESCOPIC'
): SpecialModuleCostResult => {

  const WASTE_18  = 1.20;
  const WASTE_15  = 1.20;
  const WASTE_3MM = 1.10;

  let costMaterials = 0;

  const SHEET_M2      = (2750 * 1830) / 1_000_000; // 5.0325 m²
  const SHEET_M2_55   = (2600 * 1830) / 1_000_000; // 4.758 m²
  const p18Body  = (snapshot.priceBoard18WhiteAglo  || snapshot.priceBoard18ColorAglo) / SHEET_M2;
  const p18Front = (snapshot.priceBoard18ColorAglo) / SHEET_M2;
  const p15White = (snapshot.priceBoard15WhiteAglo  || 0) / SHEET_M2;
  const p3White  = (snapshot.priceBacking3White     || 0) / SHEET_M2;
  const p55Color = (snapshot.priceBacking55Color    || 0) / SHEET_M2_55;

  result.parts.forEach(p => {
    const areaM2 = (p.width * p.height * p.quantity) / 1_000_000;
    switch (p.material) {
      case '18mm_Carcass':
        costMaterials += areaM2 * p18Body  * WASTE_18;
        break;
      case '18mm_Front':
        costMaterials += areaM2 * p18Front * WASTE_18;
        break;
      case '15mm_White':
        costMaterials += areaM2 * p15White * WASTE_15;
        break;
      case '3mm_White':
        costMaterials += areaM2 * p3White  * WASTE_3MM;
        break;
      case '5.5mm_Color':
        costMaterials += areaM2 * p55Color * (1.10);
        break;
    }
  });

  // Tapacanto estimado: perímetro de piezas 18mm y 15mm × precio canto color
  let perimeterMM = 0;
  result.parts.forEach(p => {
    if (p.material.includes('18mm') || p.material.includes('15mm')) {
      perimeterMM += (p.width + p.height) * 2 * p.quantity;
    }
  });
  costMaterials += (perimeterMM / 1000) * snapshot.priceEdge45Color045;

  // Herrajes: guías si tiene
  let costHardware = 0;
  if (result.hardware.slides && result.hardware.slides > 0) {
    const len = result.hardware.slideLength || 500;
    let priceSlide = snapshot.priceSlide500Std;
    if (len <= 300) priceSlide = snapshot.priceSlide300Std;
    else if (len <= 400) priceSlide = snapshot.priceSlide400Std;

    if (slideType === 'TELESCOPIC_SOFT') {
      if (len <= 300) priceSlide = snapshot.priceSlide300Soft;
      else if (len <= 400) priceSlide = snapshot.priceSlide400Soft;
      else priceSlide = snapshot.priceSlide500Soft;
    }
    costHardware += result.hardware.slides * priceSlide;
  }

  const costLabor = result.laborDays * snapshot.costLaborDay;

  return {
    costMaterials,
    costHardware,
    costLabor,
    totalDirectCost: costMaterials + costHardware + costLabor,
    parts: result.parts
  };
};
