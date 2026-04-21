-- ============================================================
-- MIGRACIÓN: Alinear tabla `reports` con el código actual
-- ============================================================
-- CONTEXTO:
-- El código (utils/dataMapper.ts → reportToDB) inserta columnas
-- tipadas que NO existen en el schema original (db_schema.sql).
-- Esto provoca: "Could not find the 'content' column of 'reports'".
--
-- Esta migración agrega las columnas faltantes sin romper datos
-- existentes (las nuevas columnas son NULL-ables) y relaja las
-- columnas legacy `type` y `data` para que no sean obligatorias.
--
-- EJECUTAR en el SQL Editor de Supabase → RUN.
-- ============================================================

-- 1. Agregar columnas que el código espera (NULLables para no romper filas existentes)
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS content               TEXT,
  ADD COLUMN IF NOT EXISTS project_id            UUID,
  ADD COLUMN IF NOT EXISTS observations          TEXT,
  ADD COLUMN IF NOT EXISTS generated_date        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS project_name_snapshot TEXT;

-- 2. Relajar columnas legacy que el código NO usa pero pueden estar NOT NULL
--    (no se borran: podrían contener data histórica)
ALTER TABLE public.reports
  ALTER COLUMN type DROP NOT NULL,
  ALTER COLUMN data DROP NOT NULL;

-- 3. Foreign key a projects (si no existe). ON DELETE SET NULL para
--    preservar informes aunque el proyecto se borre.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_project_id_fkey'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES public.projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Índice para consultas por proyecto
CREATE INDEX IF NOT EXISTS idx_reports_project_id
  ON public.reports(project_id);

-- 5. CRÍTICO: recargar el schema cache de PostgREST.
--    Sin esto, Supabase sigue devolviendo el error hasta un restart del proyecto.
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICACIÓN (opcional — correr por separado para confirmar)
-- ============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reports'
-- ORDER BY ordinal_position;
