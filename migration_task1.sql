-- TAREA 1: UNIFICACIÓN Y MIGRACIÓN DE PRESUPUESTOS
-- Este script crea la nueva arquitectura de presupuestos unificada y migra los datos existentes.

-- 1. Crear tabla de Listas de Precios (Contexto Inflacionario)
-- Permite saber bajo qué lista de precios se creó un presupuesto.
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- Ej: "Lista Marzo 2024"
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar que la columna inflation_rate exista (Fix error 42703)
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS inflation_rate DECIMAL(5, 2) DEFAULT 0;

-- Insertar una lista de precios por defecto para la migración
INSERT INTO public.price_lists (name, inflation_rate) VALUES ('Lista Base Migración', 0) ON CONFLICT DO NOTHING;

-- 2. Crear tabla unificada ESTIMATES
CREATE TABLE IF NOT EXISTS public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id),
    price_list_id UUID REFERENCES public.price_lists(id),
    
    -- Metadatos
    title VARCHAR(200),
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, SENT, APPROVED, REJECTED, ARCHIVED
    type VARCHAR(50) DEFAULT 'STANDARD', -- QUICK, DETAILED
    
    -- Datos JSONB (Estructura flexible para items, materiales, mano de obra)
    items JSONB DEFAULT '[]'::jsonb, 
    cost_summary JSONB DEFAULT '{}'::jsonb, -- Snapshot de costos y márgenes
    
    -- Rastreo de migración
    legacy_id TEXT, -- ID original de saved_estimates (si aplica)
    migration_source VARCHAR(20), -- 'BUDGETS' o 'SAVED_ESTIMATES'
    
    -- Timestamps y Vencimiento
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Columna calculada: Vence a los 15 días de creación
    expiration_date TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (created_at + INTERVAL '15 days') STORED
);

-- 3. Habilitar Seguridad (RLS)
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (Permisivas para MVP, ajustar según roles luego)
DROP POLICY IF EXISTS "PriceLists: Read" ON public.price_lists;
CREATE POLICY "PriceLists: Read" ON public.price_lists FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "PriceLists: Write" ON public.price_lists;
CREATE POLICY "PriceLists: Write" ON public.price_lists FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Estimates: All" ON public.estimates;
CREATE POLICY "Estimates: All" ON public.estimates FOR ALL USING (auth.role() = 'authenticated');

-- 4. MIGRACIÓN: Tabla 'budgets' -> 'estimates'
-- Agregamos los items y módulos anidados en el JSONB
INSERT INTO public.estimates (
    id, project_id, version, status, type, items, cost_summary, created_at, updated_at, migration_source, price_list_id
)
SELECT 
    b.id,
    b.project_id,
    b.version,
    CASE 
        WHEN b.status = 'LOCKED' THEN 'SENT'
        ELSE b.status 
    END,
    'DETAILED', -- Los budgets viejos eran detallados
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', bi.id,
                    'name', bi.name,
                    'margin_workshop', bi.margin_workshop,
                    'margin_commercial', bi.margin_commercial,
                    'complexity_factor', bi.complexity_factor,
                    'estimated_days', bi.estimated_days,
                    'modules', (
                        SELECT jsonb_agg(m.*) 
                        FROM modules m 
                        WHERE m.item_id = bi.id
                    )
                )
            )
            FROM budget_items bi
            WHERE bi.budget_id = b.id
        ),
        '[]'::jsonb
    ),
    jsonb_build_object(
        'total_cost', b.total_cost,
        'total_price', b.total_price,
        'snapshot', b.cost_snapshot
    ),
    b.created_at,
    b.updated_at,
    'BUDGETS',
    (SELECT id FROM public.price_lists LIMIT 1) -- Asignar lista por defecto
FROM budgets b;

-- 5. MIGRACIÓN: Tabla 'saved_estimates' -> 'estimates'
INSERT INTO public.estimates (
    legacy_id, project_id, title, version, status, type, items, cost_summary, created_at, updated_at, migration_source, price_list_id
)
SELECT 
    se.id,
    se."projectId",
    COALESCE(se."customProjectName", 'Presupuesto Rápido'),
    se.version,
    COALESCE(se."commercialStatus", 'DRAFT'),
    'QUICK', -- Asumimos que saved_estimates eran rápidos/simples
    COALESCE(se.items, se.modules, '[]'::jsonb),
    jsonb_build_object(
        'total_direct_cost', se."totalDirectCost",
        'final_price', se."finalPrice",
        'financials', se."financialsSnapshot",
        'settings', se."settingsSnapshot"
    ),
    se.date,
    se.updated_at,
    'SAVED_ESTIMATES',
    (SELECT id FROM public.price_lists LIMIT 1)
FROM saved_estimates se;

-- 6. Vista de Estado y Alertas (Dashboard)
CREATE OR REPLACE VIEW public.estimates_dashboard AS
SELECT 
    e.id,
    e.title,
    e.status,
    e.total_price_view, -- Necesitaremos extraer esto del JSONB o agregarlo como columna generada
    e.created_at,
    e.expiration_date,
    CASE 
        WHEN e.status IN ('APPROVED', 'REJECTED') THEN 'CERRADO'
        WHEN NOW() > e.expiration_date THEN 'VENCIDO'
        ELSE 'VIGENTE'
    END as validity_status,
    EXTRACT(DAY FROM (e.expiration_date - NOW()))::int as days_remaining
FROM (
    SELECT *, 
    COALESCE((cost_summary->>'total_price')::numeric, (cost_summary->>'final_price')::numeric, 0) as total_price_view
    FROM public.estimates
) e;

-- 7. Permisos
GRANT ALL ON public.price_lists TO authenticated;
GRANT ALL ON public.estimates TO authenticated;
GRANT ALL ON public.estimates_dashboard TO authenticated;
