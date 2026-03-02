export type BaseMaterial = 'MDF' | 'Aglomerado' | 'Macizo';
export type FinishType = 'Melamina' | 'Laqueado' | 'Enchapado' | 'Folio';

export interface Material {
  id: string;
  name: string;
  base_material: BaseMaterial;
  finish_type: FinishType;
  price_per_m2: number;
}

export interface QuoteItem {
  id: string;
  description: string;
  m2_technical: number; // Capa 1
  body_material_id: string; // Capa 2
  front_material_id: string; // Capa 2
  complexity_factor: number; // Capa 3
}

export interface PriceSnapshot {
  material_id: string;
  price_at_time: number;
}

export interface Quote {
  id: string;
  client_name: string;
  items: QuoteItem[];
  commercial_margin: number; // Capa 4 (e.g., 1.4 for 40%)
  price_snapshots: PriceSnapshot[]; // Snapshot de Precios
  created_at: string;
}
