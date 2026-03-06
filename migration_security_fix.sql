-- MIGRACIÓN: CORRECCIÓN DE SEGURIDAD Y RLS PARA USUARIOS
-- Descripción: Asegura la tabla public.users, habilita RLS y restringe el acceso anon.

-- 1. Habilitar RLS (Asegurarse de que esté activo)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar permisos previos inseguros (Denegar acceso público/anon)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'REVOKE ALL ON public.' || quote_ident(r.tablename) || ' FROM anon;';
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE ROW LEVEL SECURITY;';
    END LOOP;
END $$;

-- 3. Otorgar permisos base solo a usuarios autenticados
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Definir Políticas RLS para public.users

-- Borrar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS "Users: Read all" ON public.users;
DROP POLICY IF EXISTS "Users: Insert/Update own or admin" ON public.users;
DROP POLICY IF EXISTS "Users: Admin full access" ON public.users;
DROP POLICY IF EXISTS "Users: Self update" ON public.users;
DROP POLICY IF EXISTS "Users: Authenticated read" ON public.users;

-- POLÍTICA DE LECTURA:
-- Todos los usuarios autenticados pueden ver la lista de personal (necesario para asignar tareas y ver responsables).
-- Esto permite que la app funcione correctamente para Gerentes y Operarios.
CREATE POLICY "Users: Authenticated read" ON public.users
FOR SELECT
TO authenticated
USING (true);

-- POLÍTICA DE INSERCIÓN:
-- Solo el administrador puede insertar manualmente, o el trigger handle_new_user (que es SECURITY DEFINER).
CREATE POLICY "Users: Admin insert" ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.jwt() ->> 'role' = 'administrador');

-- POLÍTICA DE ACTUALIZACIÓN:
-- Los administradores pueden actualizar cualquier usuario.
-- Los usuarios pueden actualizar su propio perfil (ej: teléfono).
CREATE POLICY "Users: Update policy" ON public.users
FOR UPDATE
TO authenticated
USING (
    (auth.jwt() ->> 'role' = 'administrador') OR 
    (auth.uid() = id)
)
WITH CHECK (
    (auth.jwt() ->> 'role' = 'administrador') OR 
    (auth.uid() = id)
);

-- POLÍTICA DE ELIMINACIÓN:
-- Solo administradores pueden eliminar usuarios.
CREATE POLICY "Users: Admin delete" ON public.users
FOR DELETE
TO authenticated
USING (auth.jwt() ->> 'role' = 'administrador');

-- 5. Comentario de auditoría
COMMENT ON TABLE public.users IS 'Tabla de perfiles de usuario con RLS estricto. Acceso anon denegado.';
