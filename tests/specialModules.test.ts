/**
 * Clasificación de plantillas en los botones del estimador: Módulos (cajas) y Piezas (sueltas).
 */
import { describe, it, expect } from 'vitest';
import { SPECIAL_MODULE_TEMPLATES } from '../utils/specialModules';

const ids = (g: string) => SPECIAL_MODULE_TEMPLATES.filter(t => t.group === g).map(t => t.id).sort();

describe('grupos de plantillas', () => {
  it('toda plantilla está en Módulos o en Piezas (si no, no aparece en ningún botón)', () => {
    SPECIAL_MODULE_TEMPLATES.forEach(t => expect(['MODULO', 'PIEZA']).toContain(t.group));
  });
  it('Módulos: las cajas', () => {
    expect(ids('MODULO')).toEqual([
      'BIBLIOTECA', 'BOTINERO_EXTRAIBLE', 'BOTINERO_FIJO', 'ESQUINERO', 'ESQUINERO_EN_L',
      'MODULO_ABIERTO', 'MODULO_BAJO_MESADA', 'MODULO_HORIZONTAL',
    ]);
  });
  it('Piezas: las piezas sueltas', () => {
    expect(ids('PIEZA')).toEqual([
      'AJUSTE', 'DIVISOR_VERTICAL', 'ESTANTE_18MM', 'ESTANTE_FLOTANTE', 'LATERAL_APLICADO',
      'PANEL_ENLISTONADO', 'PANEL_LISO', 'PUERTA_18MM', 'TAPA_HORIZONTAL', 'ZOCALO_APLICADO', 'ZOCALO_ESTRUCTURAL',
    ]);
  });
});
