-- ============================================================
-- MIGRACIÓN: Resumen de Gestión por Obra
-- Fecha: 2026-05-13
-- ============================================================
-- 1. Columna de satisfacción del cliente en projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_satisfaction SMALLINT CHECK (client_satisfaction BETWEEN 1 AND 5);

-- 2. Comentario para documentar
COMMENT ON COLUMN projects.client_satisfaction IS 'Satisfacción del cliente al cierre de obra. Escala 1-5.';
COMMENT ON COLUMN projects.dossier IS 'Snapshot de gestión al momento del cierre. Incluye tiempos, ingresos, egresos, margen y snapshots financieros.';
