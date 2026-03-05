-- MIGRACIÓN TAREA 3: AGREGAR COLUMNA SETTINGS A PRICE_LISTS
-- Esta columna es necesaria para que el CostEstimator pueda guardar snapshots de configuraciones de precios.

ALTER TABLE public.price_lists ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Comentario para auditoría
COMMENT ON COLUMN public.price_lists.settings IS 'Snapshot de la configuración completa de precios (CostSettings) para esta versión.';
