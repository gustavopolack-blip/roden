-- REFACTORIZACIÓN ARQUITECTURA RØDËN V1
-- Esquema SQL para Gestión de Presupuestos, Listas de Precios y Producción.

-- 0. CONFIGURACIÓN INICIAL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tipos ENUM para consistencia y validación
DO $$ BEGIN
    CREATE TYPE public.estimate_status AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.production_stage AS ENUM ('DESIGN', 'CUTTING', 'ASSEMBLY', 'PAINTING', 'INSTALLATION', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. LISTAS DE PRECIOS (Price Lists)
-- Almacena la metadata de las versiones de precios (Inflación, Vigencia).
CREATE TABLE IF NOT EXISTS public.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- Ej: "Lista Marzo 2024"
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    inflation_rate DECIMAL(5, 2) DEFAULT 0, -- % de aumento respecto a la anterior
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ITEMS DE LISTA DE PRECIOS (Price List Items)
-- Catálogo base de materiales y mano de obra.
CREATE TABLE IF NOT EXISTS public.price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID REFERENCES public.price_lists(id) ON DELETE CASCADE,
    sku VARCHAR(50), -- Código interno
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50), -- 'Placa', 'Herraje', 'Mano de Obra', 'Servicio'
    unit VARCHAR(20), -- 'm2', 'un', 'hr', 'ml'
    unit_price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ARS', -- 'ARS' o 'USD'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PRESUPUESTOS (Estimates) - Tabla Unificada
-- Cabecera del presupuesto.
CREATE TABLE IF NOT EXISTS public.estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT REFERENCES public.projects(id),
    price_list_id UUID REFERENCES public.price_lists(id), -- Snapshot de precios usados
    
    title VARCHAR(200) NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    status public.estimate_status DEFAULT 'DRAFT',
    
    total_amount DECIMAL(12, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'ARS',
    
    -- Fechas críticas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Columna calculada: Vence a los 15 días de creación (No puede ser GENERATED porque NOW() no es inmutable)
    expiration_date DATE DEFAULT (CURRENT_DATE + 15), 
    
    created_by UUID REFERENCES auth.users(id)
);

-- 4. ITEMS DEL PRESUPUESTO (Estimate Items)
-- Detalle técnico. Normalización para evitar JSONB gigante y permitir análisis.
CREATE TABLE IF NOT EXISTS public.estimate_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID REFERENCES public.estimates(id) ON DELETE CASCADE,
    price_list_item_id UUID REFERENCES public.price_list_items(id), -- Link opcional al catálogo
    
    name VARCHAR(200) NOT NULL, -- Puede diferir del catálogo si es custom
    description TEXT,
    
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL, -- Precio congelado al momento de presupuestar
    subtotal DECIMAL(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    
    type VARCHAR(50) DEFAULT 'MATERIAL', -- 'MATERIAL', 'LABOR', 'PROFIT'
    waste_factor DECIMAL(5, 2) DEFAULT 0 -- % de desperdicio considerado (ej: 1.10 para 10%)
);

-- 5. ÓRDENES DE PRODUCCIÓN (Production Orders)
-- Se genera cuando un presupuesto pasa a APPROVED.
CREATE TABLE IF NOT EXISTS public.production_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estimate_id UUID REFERENCES public.estimates(id),
    project_id TEXT REFERENCES public.projects(id),
    
    order_number SERIAL, -- ID humano (ej: OP-104)
    current_stage public.production_stage DEFAULT 'DESIGN',
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    
    -- Datos Técnicos (JSONB para flexibilidad en estructuras complejas de taller)
    bom_data JSONB DEFAULT '[]'::jsonb, -- Lista de Materiales Real (Bill of Materials)
    cut_list_data JSONB DEFAULT '[]'::jsonb, -- Optimización de cortes
    purchase_list_data JSONB DEFAULT '[]'::jsonb, -- Insumos a comprar
    
    -- Checklist de Avance
    checklist_status JSONB DEFAULT '{
        "design_approved": false,
        "materials_ordered": false,
        "cutting_completed": false,
        "assembly_completed": false,
        "quality_check": false,
        "ready_for_install": false
    }'::jsonb,
    
    assigned_to UUID REFERENCES auth.users(id), -- Responsable técnico
    start_date DATE,
    due_date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. SEGURIDAD (RLS)
-- Habilitar RLS
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PRICE LISTS
-- Admin: Todo
CREATE POLICY "PriceLists: Admin" ON public.price_lists FOR ALL USING (
    auth.jwt() ->> 'role' = 'administrador'
);
-- Gerente/Operario: Solo lectura
CREATE POLICY "PriceLists: Staff Read" ON public.price_lists FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('gerente_taller', 'operario_taller')
);

-- POLÍTICAS PRICE LIST ITEMS
-- Admin: Todo
CREATE POLICY "PriceItems: Admin" ON public.price_list_items FOR ALL USING (
    auth.jwt() ->> 'role' = 'administrador'
);
-- Gerente/Operario: Solo lectura
CREATE POLICY "PriceItems: Staff Read" ON public.price_list_items FOR SELECT USING (
    auth.jwt() ->> 'role' IN ('gerente_taller', 'operario_taller')
);

-- POLÍTICAS ESTIMATES
-- Admin: Todo
CREATE POLICY "Estimates: Admin" ON public.estimates FOR ALL USING (
    auth.jwt() ->> 'role' = 'administrador'
);
-- Gerente: Lectura y Escritura (puede crear presupuestos técnicos)
CREATE POLICY "Estimates: Gerente" ON public.estimates FOR ALL USING (
    auth.jwt() ->> 'role' = 'gerente_taller'
);
-- Operario: Solo lectura
CREATE POLICY "Estimates: Operario Read" ON public.estimates FOR SELECT USING (
    auth.jwt() ->> 'role' = 'operario_taller'
);

-- POLÍTICAS ESTIMATE ITEMS
-- Admin: Todo
CREATE POLICY "EstimateItems: Admin" ON public.estimate_items FOR ALL USING (
    auth.jwt() ->> 'role' = 'administrador'
);
-- Gerente: Todo
CREATE POLICY "EstimateItems: Gerente" ON public.estimate_items FOR ALL USING (
    auth.jwt() ->> 'role' = 'gerente_taller'
);
-- Operario: Solo lectura
CREATE POLICY "EstimateItems: Operario Read" ON public.estimate_items FOR SELECT USING (
    auth.jwt() ->> 'role' = 'operario_taller'
);

-- POLÍTICAS PRODUCTION ORDERS
-- Admin: Todo
CREATE POLICY "Production: Admin" ON public.production_orders FOR ALL USING (
    auth.jwt() ->> 'role' = 'administrador'
);
-- Gerente: Todo (Gestiona el taller)
CREATE POLICY "Production: Gerente" ON public.production_orders FOR ALL USING (
    auth.jwt() ->> 'role' = 'gerente_taller'
);
-- Operario: Solo lectura (NO puede editar avances, según ROLES_PERMISSIONS.md)
CREATE POLICY "Production: Operario Read" ON public.production_orders FOR SELECT USING (
    auth.jwt() ->> 'role' = 'operario_taller'
);
-- Eliminamos la política de UPDATE para operarios que existía antes.

-- 7. PERMISOS BASE
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
