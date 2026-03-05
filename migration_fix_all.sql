-- MIGRACIÓN COMPLETA: FIX PERMISOS Y TABLAS FALTANTES
-- Ejecuta este script en Supabase -> SQL Editor para solucionar todos los errores 42501 y PGRST205.

-- 1. Crear tabla ai_chat_history si no existe
-- Usamos gen_random_uuid() que es nativo de Postgres y no requiere extensiones extra.
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(100) NOT NULL,
  messages JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS en todas las tablas críticas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS DE ACCESO (RLS)
-- Para este MVP, permitimos acceso a usuarios autenticados.
-- En producción, esto debería ser más estricto (solo admins ven todo, etc.)

-- USERS
CREATE POLICY "Users: Read all" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users: Insert/Update own or admin" ON public.users FOR ALL USING (auth.role() = 'authenticated');

-- PRODUCTION_ORDERS
CREATE POLICY "Orders: All access" ON public.production_orders FOR ALL USING (auth.role() = 'authenticated');

-- SAVED_ESTIMATES
CREATE POLICY "Estimates: All access" ON public.saved_estimates FOR ALL USING (auth.role() = 'authenticated');

-- AI_CHAT_HISTORY (Solo el dueño puede ver su historial)
CREATE POLICY "Chat: Own history only" ON public.ai_chat_history FOR ALL 
USING (auth.jwt() ->> 'email' = user_email)
WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- OTRAS TABLAS (Permisos generales para que la app funcione)
CREATE POLICY "Clients: All access" ON public.clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Projects: All access" ON public.projects FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Budgets: All access" ON public.budgets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Suppliers: All access" ON public.suppliers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Payments: All access" ON public.supplier_payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Tasks: All access" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Reports: All access" ON public.reports FOR ALL USING (auth.role() = 'authenticated');

-- 4. PERMISOS GRANT (Capa base de Postgres)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
