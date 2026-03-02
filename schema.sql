-- Esquema SQL para Estimador de Costos con Snapshot de Precios

-- 1. Catálogo de Materiales (Precios Actuales)
CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    base_material TEXT CHECK (base_material IN ('MDF', 'Aglomerado', 'Macizo')),
    finish_type TEXT CHECK (finish_type IN ('Melamina', 'Laqueado', 'Enchapado', 'Folio')),
    price_per_m2 DECIMAL(12, 2) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Mano de Obra y Factores
CREATE TABLE labor_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_name TEXT NOT NULL, -- e.g., 'Armado', 'Lustre', 'Instalación'
    base_rate_per_hour DECIMAL(12, 2) NOT NULL,
    complexity_factor DECIMAL(4, 2) DEFAULT 1.0
);

-- 3. Presupuestos (Quotes)
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    status TEXT DEFAULT 'Draft',
    total_cost_direct DECIMAL(12, 2),
    total_price_commercial DECIMAL(12, 2),
    commercial_margin DECIMAL(5, 2), -- e.g., 1.35 for 35% margin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Snapshot de Precios (La clave para la inmutabilidad de presupuestos viejos)
-- Esta tabla guarda los precios que se usaron en un presupuesto específico.
CREATE TABLE quote_price_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'Material' o 'Labor'
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    price_at_time DECIMAL(12, 2) NOT NULL,
    metadata JSONB -- Para guardar factores de complejidad, etc.
);

-- 5. Items del Presupuesto
CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT,
    m2_technical DECIMAL(10, 3) NOT NULL, -- Capa 1: Técnica
    body_material_id UUID REFERENCES materials(id), -- Capa 2: Materiales
    front_material_id UUID REFERENCES materials(id),
    complexity_factor DECIMAL(4, 2) DEFAULT 1.0, -- Capa 3: Motor
    calculated_cost DECIMAL(12, 2)
);

-- REGLA DE VALIDACIÓN (Nivel DB si se desea, pero usualmente en Aplicación)
-- ALTER TABLE materials ADD CONSTRAINT check_mdf_rule 
-- CHECK (NOT (finish_type IN ('Laqueado', 'Enchapado') AND base_material != 'MDF'));
