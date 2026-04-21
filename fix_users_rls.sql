-- Asegurar que RLS esté activado
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes para evitar conflictos
DROP POLICY IF EXISTS user_read_own ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;

-- Crear política de lectura para el usuario autenticado
-- Usamos auth.uid() que es el estándar en Supabase
CREATE POLICY user_read_own ON users 
FOR SELECT 
TO authenticated 
USING (id = auth.uid());

-- Política para permitir inserción si es necesario (para el trigger de auth)
DROP POLICY IF EXISTS user_insert_own ON users;
CREATE POLICY user_insert_own ON users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());
