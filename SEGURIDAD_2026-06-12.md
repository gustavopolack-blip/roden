# Endurecimiento de seguridad — 12/6/2026

## Qué se corrigió (aplicado en producción)

**1. CRÍTICO — `estimates` expuesta al público.** Tenía políticas RLS para el rol `public` con `true` en SELECT, INSERT, UPDATE y DELETE: cualquiera con la clave publicable (embebida en el bundle de la app) podía leer, modificar o borrar todos los presupuestos sin login. Las 4 políticas fueron eliminadas. Verificado: el rol anónimo ya no ve ninguna fila.

**2. Matriz de escrituras por rol a nivel base de datos.** Antes, 17 tablas permitían a *cualquier usuario autenticado* hacer todo: un operario con sus credenciales podía editar clientes o finanzas vía API directa aunque la interfaz se lo ocultara. Ahora las lecturas siguen abiertas a autenticados (la app las necesita en todos los roles) y las escrituras quedaron así:

| Tabla | Escriben |
|---|---|
| clients, suppliers, supplier_payments, estimates, saved_estimates, budgets, budget_items, price_lists, price_catalog, item_templates, modules, web_portfolio | solo administrador |
| projects, production_orders, notas_gestion | administrador + gerente_taller |
| tasks, reports | insertar/editar: los 3 roles · eliminar: solo administrador |
| users | (ya estaba bien) escriben solo admins |
| mkt_leads, mkt_assets, mkt_piezas | solo administrador (vía mkt_is_admin) |

Implementado con la función `roden_role()` (security definer, lee `users` por `auth.uid()`).

**3. Módulo de marketing cerrado al anónimo.** Se eliminaron las políticas `anon` de las tablas `mkt_*` que usaba la app HTML provisoria. El módulo se opera únicamente desde rødën OS con sesión de administrador.

**4. Higiene de funciones.** `set_updated_at` con `search_path` fijo; `handle_new_user` y `mkt_recompra_admin` sin EXECUTE para anon/authenticated vía API (el trigger y el RPC admin siguen funcionando donde corresponde).

## Qué queda intencionalmente abierto
- `web_portfolio`: lectura pública con filtro `activo = true` — lo usa el sitio web.
- `notifications`: insert/update para autenticados — lo requiere el sistema de campanita entre roles.
- Bucket `portfolio-fotos`: listado público (advisor lo marca; si la web no necesita listar, se puede cerrar).

## Pendiente manual (no se puede hacer por API)
- **Activar "Leaked password protection"**: Dashboard de Supabase → Authentication → Settings → Password protection (chequea contraseñas filtradas contra HaveIBeenPwned).

## Si algo falla
Si un flujo de gerente u operario da error de permisos que antes funcionaba, ejecutar `migration_rollback_security_hardening.sql` en el SQL Editor (restaura el estado anterior EXCEPTO el agujero crítico de estimates) y reportar qué acción falló para ajustar esa política puntual.

## Prueba recomendada
Entrar con cada rol y ejecutar su flujo habitual: gerente → avanzar etapa de producción y crear nota técnica; operario → ver órdenes y completar una tarea; admin → todo. Cualquier error de "row-level security" indica una política a ajustar (no revertir todo por un caso puntual).
