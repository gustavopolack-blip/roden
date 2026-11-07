-- Endurecimiento del alta de usuarios — 7/11/2026 (aplicado en producción).
--
-- Antes: handle_new_user tomaba el rol de raw_user_meta_data, que manda el navegador al registrarse.
-- Con la clave publicable (embebida en la app), cualquiera que pudiera registrarse podía pedir
-- role = 'administrador'.
-- Ahora: el rol sale de raw_app_meta_data, que solo se escribe del lado servidor (Edge Function
-- crear-usuario, con la clave de servicio). Sin rol válido ahí, el usuario nace operario_taller.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_role text := NEW.raw_app_meta_data->>'role';
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('administrador', 'gerente_taller', 'operario_taller') THEN
    v_role := 'operario_taller';
  END IF;
  INSERT INTO public.users (id, name, email, phone, role, status, joined_date, avatar_initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    v_role,
    'ACTIVE',
    CURRENT_DATE,
    UPPER(SUBSTRING(COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 1, 2))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
