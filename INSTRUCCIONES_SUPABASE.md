# Instrucciones para Corregir Usuarios en Supabase

Para solucionar el problema de que no se ven los usuarios y no se crean correctamente, debes ejecutar el siguiente script SQL en el **Editor SQL** de tu panel de Supabase.

Este script hace 3 cosas:
1. Crea una función para sincronizar automáticamente usuarios de Auth a la tabla pública.
2. Activa un "Trigger" para que esto pase automáticamente en cada registro nuevo.
3. Copia los usuarios que YA existen en Auth hacia la tabla pública (Backfill).

## Pasos:
1. Ve a tu proyecto en Supabase.
2. Entra a **SQL Editor**.
3. Crea una "New Query".
4. Pega el siguiente código y dale a **Run**.

```sql
-- 0. Asegurar que las columnas necesarias existan
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS joined_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_initials VARCHAR(5);

-- 1. Función de sincronización
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

-- 2. Trigger (Borrador y recreación)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. BACKFILL (Reparar usuarios existentes)
-- Esto copiará todos los usuarios que ya están registrados pero no se ven en el sistema
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
```

Una vez ejecutado, recarga la aplicación web y deberías ver los usuarios.
