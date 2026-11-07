-- Lecturas por rol en la base — 7/11/2026 (aplicado en producción).
--
-- Antes: cualquier usuario con sesión leía todas las tablas (políticas *_read_auth con true). La
-- pantalla ocultaba datos, pero un operario podía leer clientes, precios, presupuestos y pagos
-- llamando directo a la API.
-- Ahora cada rol lee lo que usan sus pantallas (constants.ts → PAGE_PERMISSIONS):
--
-- | Tabla | administrador | gerente_taller | operario_taller |
-- |---|---|---|---|
-- | projects | todo | PROPOSAL, QUOTING, PRODUCTION, READY, COMPLETED (Taller pasa a producción las PROPOSAL/QUOTING) | PRODUCTION, READY, COMPLETED |
-- | clients | todo | los de sus obras visibles | los de sus obras visibles |
-- | supplier_payments | todo | solo proveedor "Taller" | nada |
-- | suppliers | todo | todo | nada |
-- | saved_estimates, estimates, budgets, budget_items, price_lists, price_catalog, item_templates, modules | todo | nada | nada |
--
-- Sin cambios: users, tasks, reports, production_orders, notas_gestion, notifications,
-- material_library, web_portfolio, mkt_*, ai_chat_history.
-- Escrituras: sin cambios (projects se separa en INSERT/UPDATE/DELETE para que la política de
-- escritura no le abra la lectura de todo al gerente; mismos roles que antes).
--
-- Para volver atrás: recrear las políticas "<tabla>_read_auth" FOR SELECT TO authenticated USING (true)
-- y "projects_write_roles" FOR ALL con administrador,gerente_taller.

-- Solo administrador (las políticas *_write_roles FOR ALL ya le dan la lectura)
DROP POLICY IF EXISTS saved_estimates_read_auth ON public.saved_estimates;
DROP POLICY IF EXISTS estimates_read_auth ON public.estimates;
DROP POLICY IF EXISTS budgets_read_auth ON public.budgets;
DROP POLICY IF EXISTS budget_items_read_auth ON public.budget_items;
DROP POLICY IF EXISTS price_lists_read_auth ON public.price_lists;
DROP POLICY IF EXISTS price_catalog_read_auth ON public.price_catalog;
DROP POLICY IF EXISTS item_templates_read_auth ON public.item_templates;
DROP POLICY IF EXISTS modules_read_auth ON public.modules;

-- Obras
DROP POLICY IF EXISTS projects_read_auth ON public.projects;
DROP POLICY IF EXISTS projects_write_roles ON public.projects;
CREATE POLICY projects_read_roles ON public.projects FOR SELECT TO authenticated USING (
  (SELECT public.roden_role()) = 'administrador'
  OR ((SELECT public.roden_role()) = 'gerente_taller' AND status IN ('PROPOSAL', 'QUOTING', 'PRODUCTION', 'READY', 'COMPLETED'))
  OR ((SELECT public.roden_role()) = 'operario_taller' AND status IN ('PRODUCTION', 'READY', 'COMPLETED'))
);
CREATE POLICY projects_insert_roles ON public.projects FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.roden_role()) IN ('administrador', 'gerente_taller'));
CREATE POLICY projects_update_roles ON public.projects FOR UPDATE TO authenticated
  USING ((SELECT public.roden_role()) IN ('administrador', 'gerente_taller'))
  WITH CHECK ((SELECT public.roden_role()) IN ('administrador', 'gerente_taller'));
CREATE POLICY projects_delete_roles ON public.projects FOR DELETE TO authenticated
  USING ((SELECT public.roden_role()) IN ('administrador', 'gerente_taller'));

-- Clientes: los de las obras que el rol ve (la subconsulta respeta la política de projects)
DROP POLICY IF EXISTS clients_read_auth ON public.clients;
CREATE POLICY clients_read_roles ON public.clients FOR SELECT TO authenticated USING (
  (SELECT public.roden_role()) = 'administrador'
  OR id IN (SELECT client_id FROM public.projects)
);

-- Pagos a proveedores: el gerente solo los del proveedor "Taller"
DROP POLICY IF EXISTS supplier_payments_read_auth ON public.supplier_payments;
CREATE POLICY supplier_payments_read_manager ON public.supplier_payments FOR SELECT TO authenticated USING (
  (SELECT public.roden_role()) = 'gerente_taller' AND lower(provider_name) = 'taller'
);

-- Proveedores: administrador y gerente
DROP POLICY IF EXISTS suppliers_read_auth ON public.suppliers;
CREATE POLICY suppliers_read_manager ON public.suppliers FOR SELECT TO authenticated USING (
  (SELECT public.roden_role()) = 'gerente_taller'
);
