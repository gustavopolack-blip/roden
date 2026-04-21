-- unblock_all_tables.sql
-- Este script desactiva el RLS y otorga permisos totales para asegurar que la app cargue todos los datos.

-- 1. Desactivar RLS en todas las tablas para evitar errores 42501
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budgets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.estimates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_lists DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_catalog DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_chat_history DISABLE ROW LEVEL SECURITY;

-- 2. Otorgar permisos totales a los roles de Supabase
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Asegurar que la tabla 'users' tenga la estructura correcta (Personal)
-- Si no existe, la creamos basada en db_schema.sql
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  joined_date DATE DEFAULT CURRENT_DATE,
  avatar_initials VARCHAR(5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Asegurar que la tabla 'reports' tenga las columnas necesarias para la app (Finanzas)
-- La app espera: id, title, date, content, projectId, observations, generatedDate, projectNameSnapshot
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS "projectId" UUID;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS "observations" TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS "generatedDate" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS "projectNameSnapshot" VARCHAR(200);
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS "content" TEXT;

-- 5. Asegurar que 'supplier_payments' tenga las columnas correctas (Proveedores)
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS "provider_name" VARCHAR(200);
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS "concept" TEXT;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS "down_payment" DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.supplier_payments ADD COLUMN IF NOT EXISTS "balance" DECIMAL(12, 2) DEFAULT 0;

-- 6. Crear un alias 'profiles' para 'users' por si acaso
-- Esto ayuda si alguna parte del sistema aún busca 'profiles'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'profiles') THEN
        CREATE VIEW public.profiles AS SELECT * FROM public.users;
    END IF;
END
$$;
