-- MIGRACIÓN: Sincronización Automática Auth -> Public Users
-- Descripción: Crea el trigger necesario para que cada vez que un usuario se registre en Supabase Auth,
-- se cree automáticamente su perfil en la tabla public.users.

-- 1. Función que maneja el evento de nuevo usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, status, joined_date, avatar_initials)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'operario_taller'), -- Rol por defecto seguro
    'ACTIVE',
    CURRENT_DATE,
    COALESCE(
        substring((new.raw_user_meta_data->>'name') from 1 for 2), 
        substring(new.email from 1 for 2)
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger que dispara la función
-- Primero borramos si existe para evitar duplicados en migraciones repetidas
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. (Opcional) Backfill para usuarios existentes que no estén en public.users
-- Nota: Esto solo funciona si se ejecuta con privilegios de superusuario o desde la consola SQL de Supabase
-- INSERT INTO public.users (id, email, name, role, status, joined_date, avatar_initials)
-- SELECT 
--     id, 
--     email, 
--     COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
--     COALESCE(raw_user_meta_data->>'role', 'operario_taller'),
--     'ACTIVE',
--     created_at::date,
--     substring(email from 1 for 2)
-- FROM auth.users
-- WHERE id NOT IN (SELECT id FROM public.users);
