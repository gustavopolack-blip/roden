-- SCRIPT DE RESCATE Y REPARACIÓN TOTAL
-- Ejecuta esto en Supabase -> SQL Editor para recuperar el acceso a tus datos y arreglar los usuarios.

-- 1. SOLUCIÓN DE USUARIOS (Columnas faltantes)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_initials VARCHAR(5);

-- 2. SOLUCIÓN DE TABLA CHAT (Si falta)
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Usa nativo de Postgres
  user_email VARCHAR(100) NOT NULL,
  messages JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RESTAURAR ACCESO A DATOS (Policies)
-- Primero habilitamos RLS en todas las tablas para seguridad
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- Borramos políticas viejas o rotas para empezar de limpio
DROP POLICY IF EXISTS "Users: Read all" ON public.users;
DROP POLICY IF EXISTS "Users: Insert/Update own or admin" ON public.users;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.users;

-- CREAMOS POLÍTICAS PERMISIVAS (Para que veas tus datos YA)
-- Nota: 'authenticated' significa cualquier usuario logueado.

-- Users
CREATE POLICY "Users: Read all" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users: Modify" ON public.users FOR ALL USING (auth.role() = 'authenticated');

-- Projects
DROP POLICY IF EXISTS "Projects: All" ON public.projects;
CREATE POLICY "Projects: All" ON public.projects FOR ALL USING (auth.role() = 'authenticated');

-- Clients
DROP POLICY IF EXISTS "Clients: All" ON public.clients;
CREATE POLICY "Clients: All" ON public.clients FOR ALL USING (auth.role() = 'authenticated');

-- Budgets
DROP POLICY IF EXISTS "Budgets: All" ON public.budgets;
CREATE POLICY "Budgets: All" ON public.budgets FOR ALL USING (auth.role() = 'authenticated');

-- Suppliers & Payments
DROP POLICY IF EXISTS "Suppliers: All" ON public.suppliers;
CREATE POLICY "Suppliers: All" ON public.suppliers FOR ALL USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Payments: All" ON public.supplier_payments;
CREATE POLICY "Payments: All" ON public.supplier_payments FOR ALL USING (auth.role() = 'authenticated');

-- Tasks
DROP POLICY IF EXISTS "Tasks: All" ON public.tasks;
CREATE POLICY "Tasks: All" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');

-- Reports
DROP POLICY IF EXISTS "Reports: All" ON public.reports;
CREATE POLICY "Reports: All" ON public.reports FOR ALL USING (auth.role() = 'authenticated');

-- Production Orders
DROP POLICY IF EXISTS "Orders: All" ON public.production_orders;
CREATE POLICY "Orders: All" ON public.production_orders FOR ALL USING (auth.role() = 'authenticated');

-- Saved Estimates
DROP POLICY IF EXISTS "Estimates: All" ON public.saved_estimates;
CREATE POLICY "Estimates: All" ON public.saved_estimates FOR ALL USING (auth.role() = 'authenticated');

-- Chat History
DROP POLICY IF EXISTS "Chat: Own" ON public.ai_chat_history;
CREATE POLICY "Chat: Own" ON public.ai_chat_history FOR ALL 
USING (auth.jwt() ->> 'email' = user_email)
WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- 4. SINCRONIZACIÓN DE USUARIOS (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, status, joined_date, avatar_initials)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'operario_taller'),
    'ACTIVE',
    CURRENT_DATE,
    UPPER(LEFT(COALESCE(new.raw_user_meta_data->>'name', new.email), 2))
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. BACKFILL (Recuperar usuarios que no se ven)
INSERT INTO public.users (id, email, name, role, status, joined_date, avatar_initials)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
    COALESCE(raw_user_meta_data->>'role', 'operario_taller'),
    'ACTIVE',
    created_at::date,
    UPPER(LEFT(COALESCE(raw_user_meta_data->>'name', email), 2))
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.users);

-- 6. PERMISOS FINALES
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
