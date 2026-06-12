-- ============================================================
-- ROLLBACK del endurecimiento de seguridad (12/6/2026)
-- Ejecutar SOLO si algún flujo de la app falla por permisos y
-- se necesita volver temporalmente al estado anterior.
-- NO restaura las políticas public de estimates (eso era una
-- vulnerabilidad crítica y no debe volver).
-- ============================================================

do $$
declare
  t text;
  tablas text[] := array['clients','projects','production_orders','suppliers',
    'supplier_payments','estimates','saved_estimates','budgets','budget_items',
    'price_lists','price_catalog','item_templates','modules','notas_gestion','web_portfolio'];
begin
  foreach t in array tablas loop
    execute format('drop policy if exists %I on %I', t || '_read_auth', t);
    execute format('drop policy if exists %I on %I', t || '_write_roles', t);
    execute format('create policy %I on %I for all to authenticated using (true) with check (true)',
                   t || '_all_auth_ROLLBACK', t);
  end loop;
end $$;

drop policy if exists "tasks_read_auth" on tasks;
drop policy if exists "tasks_cud_roles" on tasks;
drop policy if exists "tasks_upd_roles" on tasks;
drop policy if exists "tasks_del_admin" on tasks;
create policy "tasks_all_auth_ROLLBACK" on tasks for all to authenticated using (true) with check (true);

drop policy if exists "reports_read_auth" on reports;
drop policy if exists "reports_ins_roles" on reports;
drop policy if exists "reports_upd_roles" on reports;
drop policy if exists "reports_del_admin" on reports;
create policy "reports_all_auth_ROLLBACK" on reports for all to authenticated using (true) with check (true);
