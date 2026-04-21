-- Script para solucionar errores de permisos (RLS) en Supabase
-- Copia y pega este código en el SQL Editor de tu proyecto en Supabase y ejecútalo.

-- 1. Asegurarnos de que todas las tablas tengan RLS activado
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saved_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas anteriores que puedan estar causando conflictos
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.clients;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.projects;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.budgets;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.budget_items;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.modules;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.suppliers;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.supplier_payments;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.tasks;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.users;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.reports;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.production_orders;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.saved_estimates;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.estimates;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.price_lists;

-- 3. Crear políticas permisivas para usuarios autenticados
CREATE POLICY "Allow all for authenticated" ON public.clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.projects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.budgets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.budget_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.modules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.suppliers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.supplier_payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.reports FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.production_orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.saved_estimates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.estimates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON public.price_lists FOR ALL USING (auth.role() = 'authenticated');

-- 4. Política específica para el historial de chat (solo el propio usuario)
DROP POLICY IF EXISTS "Chat: Own history only" ON public.ai_chat_history;
CREATE POLICY "Chat: Own history only" ON public.ai_chat_history FOR ALL 
USING (auth.jwt() ->> 'email' = user_email)
WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- 5. Otorgar permisos base a nivel de base de datos
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
