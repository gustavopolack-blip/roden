-- TAREA 2: MIGRACIÓN DE DATOS (BUDGETS & SAVED_ESTIMATES -> ESTIMATES)
-- Este script mueve los datos históricos a la nueva estructura unificada.

-- Asegurar que la columna inflation_rate exista (Fix error 42703)
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS inflation_rate DECIMAL(5, 2) DEFAULT 0;

-- Asegurar que la columna valid_from exista (Fix error 42703)
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT CURRENT_DATE;

-- Asegurar que la columna is_active exista (Fix error 42703)
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Asegurar que la columna valid_until exista (Prevent future error)
ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Fix error 23502: settings column exists in legacy table and is NOT NULL.
-- We relax this constraint to allow migration.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'price_lists' AND column_name = 'settings') THEN
        ALTER TABLE public.price_lists ALTER COLUMN settings DROP NOT NULL;
        ALTER TABLE public.price_lists ALTER COLUMN settings SET DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 1. Crear una Lista de Precios Base para los datos históricos
INSERT INTO public.price_lists (name, inflation_rate, valid_from, is_active)
VALUES ('Lista Histórica (Migración)', 0, '2020-01-01', TRUE)
ON CONFLICT DO NOTHING;

-- Capturar el ID de la lista base
DO $$
DECLARE
    base_price_list_id UUID;
BEGIN
    SELECT id INTO base_price_list_id FROM public.price_lists WHERE name = 'Lista Histórica (Migración)' LIMIT 1;

    -- 2. MIGRAR 'BUDGETS' (Legacy) -> 'ESTIMATES'
    -- Los budgets viejos se convierten en estimates con status mapeado.
    INSERT INTO public.estimates (
        project_id,
        price_list_id,
        title,
        description,
        version,
        status,
        total_amount,
        created_at,
        updated_at,
        created_by
    )
    SELECT 
        b."projectId"::text, -- Fix: camelCase
        base_price_list_id,
        'Presupuesto Legacy #' || b.version,
        'Migrado desde sistema anterior (Budgets)',
        b.version,
        CASE 
            WHEN b.status = 'DRAFT' THEN 'DRAFT'::public.estimate_status
            WHEN b.status = 'SENT' THEN 'SENT'::public.estimate_status
            WHEN b.status = 'APPROVED' THEN 'APPROVED'::public.estimate_status
            WHEN b.status = 'REJECTED' THEN 'REJECTED'::public.estimate_status
            WHEN b.status = 'LOCKED' THEN 'SENT'::public.estimate_status -- Locked se asume enviado
            ELSE 'DRAFT'::public.estimate_status
        END,
        b.total_price, -- Fix: snake_case (revert)
        b.created_at, -- Fix: snake_case (revert)
        b.updated_at, -- Fix: snake_case (revert)
        (SELECT id FROM auth.users LIMIT 1) -- Asignar a un usuario admin por defecto si no hay user_id en budget
    FROM public.budgets b;

    -- 3. MIGRAR ITEMS DE 'BUDGETS' -> 'ESTIMATE_ITEMS'
    -- Esto es complejo porque budget_items tiene estructura diferente.
    -- Hacemos un mapeo simple: Nombre = Item Name, Precio = Unit Price, Cantidad = 1 (ya que budget_items solían ser globales)
    INSERT INTO public.estimate_items (
        estimate_id,
        name,
        description,
        quantity,
        unit_price,
        type
    )
    SELECT 
        e.id,
        bi.name,
        'Item migrado de presupuesto legacy',
        1, -- Cantidad por defecto
        bi.total_price, -- Fix: snake_case (revert)
        'MATERIAL' -- Tipo por defecto
    FROM public.budget_items bi
    JOIN public.budgets b ON b.id = bi.budget_id -- Fix: snake_case (revert)
    JOIN public.estimates e ON e.project_id = b."projectId"::text AND e.version = b.version AND e.title LIKE 'Presupuesto Legacy%';

    -- 4. MIGRAR 'SAVED_ESTIMATES' (Estimador Nuevo) -> 'ESTIMATES'
    -- Estos son más ricos en datos.
    INSERT INTO public.estimates (
        project_id,
        price_list_id,
        title,
        description,
        version,
        status,
        total_amount,
        created_at,
        updated_at,
        created_by
    )
    SELECT 
        CASE 
            WHEN se."projectId" = 'NEW' OR se."projectId" IS NULL THEN NULL 
            ELSE se."projectId" 
        END,
        base_price_list_id,
        COALESCE(se."customProjectName", 'Estimación #' || se.id),
        'Migrado desde Estimador de Costos',
        se.version,
        CASE 
            WHEN se."commercialStatus" = 'DRAFT' THEN 'DRAFT'::public.estimate_status
            WHEN se."commercialStatus" = 'SENT' THEN 'SENT'::public.estimate_status
            WHEN se."commercialStatus" = 'APPROVED' THEN 'APPROVED'::public.estimate_status
            WHEN se."commercialStatus" = 'REJECTED' THEN 'REJECTED'::public.estimate_status
            ELSE 'DRAFT'::public.estimate_status
        END,
        se."finalPrice",
        se.date,
        se.updated_at,
        (SELECT id FROM auth.users LIMIT 1)
    FROM public.saved_estimates se;

    -- Nota: Migrar los items de saved_estimates es muy complejo porque están en JSONB (items/modules).
    -- Para esta primera fase, migramos la cabecera. Los detalles quedan en la tabla vieja para consulta si es necesario,
    -- o se pueden migrar con un script de Node.js que parsee el JSON.
    -- SQL puro para parsear ese JSONB variable es riesgoso y propenso a errores.

END $$;
