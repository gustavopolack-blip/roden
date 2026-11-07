-- Verificación en dos pasos (MFA) exigida por la base — 7/11/2026 (aplicado en producción).
--
-- Quien activa el código de 6 dígitos (Configuración → Seguridad) queda obligado a usarlo: una
-- sesión que solo pasó la contraseña (aal1) no lee ni escribe ninguna tabla salvo users (que la app
-- necesita para cargar el perfil y pedir el código). Quien no lo activó, sigue igual.
-- Si se pierde el celular: Supabase → Authentication → Users → el usuario → borrar el factor MFA.
--
-- Para volver atrás: DROP POLICY mfa_required ON <cada tabla>; DROP FUNCTION public.roden_mfa_ok();

CREATE OR REPLACE FUNCTION public.roden_mfa_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = auth.uid() AND f.status = 'verified');
$function$;
REVOKE EXECUTE ON FUNCTION public.roden_mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roden_mfa_ok() TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'users' LOOP
    EXECUTE format('DROP POLICY IF EXISTS mfa_required ON public.%I', t);
    EXECUTE format('CREATE POLICY mfa_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
                   'USING ((SELECT public.roden_mfa_ok())) WITH CHECK ((SELECT public.roden_mfa_ok()))', t);
  END LOOP;
END $$;
