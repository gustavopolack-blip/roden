-- INSTRUCCIONES DE SEGURIDAD (RLS) Y REPARACIÓN DE TABLAS
-- Ejecuta este script completo en el SQL Editor de Supabase para solucionar los errores de permisos y tablas faltantes.

-- 1. Habilitar RLS en todas las tablas críticas
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- 2. Crear políticas de acceso (Permisivas para este MVP, ajustar luego para producción estricta)

-- USERS: Permitir lectura a todos los autenticados (necesario para ver staff)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (auth.role() = 'authenticated');

-- USERS: Permitir insert/update solo al propio usuario o admins (simplificado a todos autenticados por ahora para evitar bloqueos)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.users;
CREATE POLICY "Enable insert for authenticated users" ON public.users FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.users;
CREATE POLICY "Enable update for authenticated users" ON public.users FOR UPDATE USING (auth.role() = 'authenticated');

-- PRODUCTION_ORDERS: Lectura y escritura para autenticados
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.production_orders;
CREATE POLICY "Enable all access for authenticated users" ON public.production_orders FOR ALL USING (auth.role() = 'authenticated');

-- SAVED_ESTIMATES: Lectura y escritura para autenticados
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.saved_estimates;
CREATE POLICY "Enable all access for authenticated users" ON public.saved_estimates FOR ALL USING (auth.role() = 'authenticated');

-- 3. Crear tabla ai_chat_history si no existe (Error PGRST205)
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email VARCHAR(100) NOT NULL,
  messages JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS y políticas para ai_chat_history
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can manage their own chat history" 
ON public.ai_chat_history 
FOR ALL 
USING (auth.jwt() ->> 'email' = user_email)
WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- 4. Asegurar permisos de GRANT para el rol authenticated
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.production_orders TO authenticated;
GRANT ALL ON TABLE public.saved_estimates TO authenticated;
GRANT ALL ON TABLE public.ai_chat_history TO authenticated;
