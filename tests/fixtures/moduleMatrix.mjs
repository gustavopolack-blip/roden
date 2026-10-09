// Matriz de módulos e ítems para las pruebas de preservación del motor de costos.
// JS plano (sin tipos) para que lo usen tanto vitest como el script que generó la foto
// de referencia (baseline) a partir del código ANTES de extraer el motor.

const BASE = {
  width: 600, height: 720, depth: 580, quantity: 1,
  cntDoors: 0, cntFlaps: 0, cntDrawers: 0,
  moduleType: 'MELAMINE_FULL', isWhiteStructure: false,
  materialColorName: '', materialFrontName: '',
  backingType: '3MM_WHITE', isMDFCore: false, edgeCategory: 'PVC_045',
  hingeType: 'COMMON', slideType: 'TELESCOPIC',
  calculateHinges: true, calculateSlides: true, hasGasPistons: false,
  extras: [], structureCore: 'AGLO', frontsCore: 'AGLO',
};

export function buildStandardModules() {
  const out = [];
  let n = 0;
  const add = (over) => out.push({ ...BASE, id: `std${n++}`, name: `std${n}`, ...over });
  for (const backingType of ['3MM_WHITE', '55_COLOR', 'NONE', '18MM_STRUCTURE', '5.5MM_COLOR']) add({ backingType, cntDoors: 2 });
  for (const [structureCore, frontsCore, isWhiteStructure] of [['AGLO','AGLO',true],['MDF','MDF',true],['MDF','MDF',false],['AGLO','MDF',false]]) {
    add({ structureCore, frontsCore, isWhiteStructure, cntDoors: 1 });
  }
  add({ moduleType: 'MELAMINE_STRUCT_LACQUER', frontsCore: 'MDF', cntDoors: 2, finishSheen: 'GLOSS' });
  add({ moduleType: 'MELAMINE_STRUCT_VENEER', frontsCore: 'MDF', cntDrawers: 3 });
  add({ moduleType: 'LACQUER_FULL', structureCore: 'MDF', frontsCore: 'MDF', cntDoors: 2 });
  add({ cntDrawers: 3, slideType: 'TELESCOPIC_SOFT' });
  add({ cntDrawers: 1, cntDoors: 2, drawerFrontHeight: 150 });
  add({ cntDrawers: 1, cntDoors: 2 });
  add({ height: 2000, cntFlaps: 1, cntDoors: 2, flapFrontHeight: 400, hasGasPistons: true });
  add({ height: 2300, width: 900, depth: 650, cntDoors: 3, hingeType: 'SOFT_CLOSE', cntDrawers: 0 });
  add({ height: 400, cntFlaps: 2, hasGasPistons: true, hingeType: 'PUSH' });
  add({ edgeCategory: 'PVC_2MM', cntDoors: 2, materialColorName: 'Gris Humo', materialFrontName: 'Roble Kendal' });
  add({ quantity: 3, cntDoors: 2, extras: [{ id: 'e1', description: 'Cubiertero', quantity: 1, unit: 'un', unitPrice: 10000 }] });
  add({ depth: 650, cntDrawers: 2, slideType: 'HIDDEN_METAL_SIDE' });
  add({ depth: 450, cntDrawers: 2, slideType: 'Z_TYPE' });
  return out;
}

export function buildSpecialModules(templates) {
  const out = [];
  templates.forEach((t, i) => {
    const opts = {};
    (t.extraOptions || []).forEach(o => {
      opts[o.key] = o.type === 'select' ? o.options[o.options.length - 1].value : String(o.defaultValue ?? 1);
    });
    const fixed = t.fixedDims ? t.fixedDims(opts) : {};
    const dims = { width: fixed.width ?? 900, height: fixed.height ?? 720, depth: fixed.depth ?? 450 };
    const r = t.calculate(dims, opts);
    out.push({
      ...BASE, ...dims, id: `sp${i}`, name: t.name, moduleType: 'SPECIAL',
      isSpecialModule: true, specialTemplateId: t.id, specialOptions: opts,
      specialParts: r.parts, specialHardware: r.hardware, specialLaborDays: r.laborDays,
      isWhiteStructure: i % 2 === 0, structureCore: i % 3 === 0 ? 'MDF' : 'AGLO',
    });
  });
  return out;
}

export function buildManualModule() {
  return { ...BASE, id: 'man', name: 'Base hierro', moduleType: 'MANUAL', isSpecialModule: true,
    specialTemplateId: 'ESPECIAL_MANUAL', extras: [{ id: 'x', description: 'Base hierro', quantity: 1, unit: 'un', unitPrice: 300000 }] };
}

export function buildItems(templates) {
  const std = buildStandardModules();
  const sp = buildSpecialModules(templates);
  const item = (id, modules, extra = {}) => ({ id, name: id, modules, labor: { workers: 2, days: 3 }, margins: { workshop: 35, roden: 25 }, ...extra });
  return [
    item('cocina', std.slice(0, 6)),
    item('placard', std.slice(6, 14)),
    item('mixto', [...std.slice(14), ...sp.slice(0, 4)]),
    item('especiales', sp),
    item('con_manual', [std[0], buildManualModule()]),
  ];
}

// Lista de precios fija para las pruebas (valores de la lista "Agosto 2026" + campos nuevos)
export const TEST_SNAPSHOT = {
  priceScrews: 40000, costLaborDay: 85000, priceEdge2mm: 2270, priceGlueTin: 38000, priceGasPiston: 4000,
  priceHingePush: 2600, priceSlide300Std: 5000, priceSlide400Std: 6500, priceSlide500Std: 8000,
  priceSlide300Push: 9000, priceSlide300Soft: 9000, priceSlide400Push: 10500, priceSlide400Soft: 10500,
  priceSlide500Push: 12000, priceSlide500Soft: 12000, priceSlide500Hidden: 25000,
  priceBacking3White: 39000, priceHingeStandard: 1600, priceBacking55Color: 72300,
  priceEdge22Color045: 990, priceEdge22White045: 630, priceEdge45Color045: 2170, priceEdge45White045: 1050,
  priceHingeSoftClose: 2600, priceBoard18ColorMDF: 151400, priceBoard18WhiteMDF: 114800,
  priceBoard15WhiteAglo: 82500, priceBoard18ColorAglo: 124600, priceBoard18VeneerMDF: 178200,
  priceBoard18WhiteAglo: 92000, priceFinishLustreSemi: 140000, priceFinishLacquerSemi: 140000,
  priceFinishLustreGloss: 150000, priceFinishLacquerGloss: 150000, priceBoard18MDFCrudo1Face: 110000,
};
