# ✅ CHECKLIST PRE-DEPLOYMENT

Verificar estos items antes de cada deploy a producción.

---

## 🗄️ BASE DE DATOS

- [ ] `supabase_setup_complete.sql` ejecutado en Supabase
- [ ] Todas las tablas creadas correctamente
- [ ] RLS policies activas en todas las tablas
- [ ] Trigger `on_auth_user_created` funcionando
- [ ] Usuario administrador creado con role `administrador`
- [ ] Al menos 1 usuario puede hacer login

**Verificación rápida:**
```sql
-- En Supabase SQL Editor
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- Debe mostrar 15 tablas

SELECT * FROM users WHERE role = 'administrador';
-- Debe mostrar al menos 1 usuario
```

---

## 🔐 AUTENTICACIÓN

- [ ] Usuario administrador creado en Supabase Auth
- [ ] Email confirmado (o confirmación deshabilitada para desarrollo)
- [ ] Registro de usuario en `public.users` coincide con `auth.users`
- [ ] Role es `administrador` en `public.users`

**Verificación:**
```sql
SELECT u.id, u.email, pu.role, pu.status 
FROM auth.users u 
LEFT JOIN public.users pu ON u.id = pu.id 
WHERE u.email = 'tu-email@ejemplo.com';
```

---

## 🌍 VARIABLES DE ENTORNO

### Desarrollo (.env local)
- [ ] `VITE_SUPABASE_URL` configurada
- [ ] `VITE_SUPABASE_ANON_KEY` configurada
- [ ] `VITE_GEMINI_API_KEY` configurada
- [ ] Todas empiezan con `VITE_` (requerido por Vite)
- [ ] `.env` está en `.gitignore`

### Producción (Vercel)
- [ ] Las 3 variables agregadas en Vercel Dashboard
- [ ] Sin espacios extra antes/después de los valores
- [ ] Sin comillas alrededor de los valores
- [ ] Aplicadas a Environment: Production

---

## 🏗️ BUILD

- [ ] `npm install` ejecuta sin errores
- [ ] `npm run build` ejecuta sin errores
- [ ] `dist/` se genera correctamente
- [ ] No hay warnings de TypeScript críticos
- [ ] `vercel.json` existe en la raíz

**Verificación:**
```bash
npm run build
# Debe terminar con: "✓ built in XXXXms"
ls dist/
# Debe mostrar: index.html, assets/
```

---

## 📁 ARCHIVOS CRÍTICOS

- [ ] `vercel.json` con rewrites para SPA
- [ ] `.gitignore` incluye `.env`, `node_modules`, `dist`
- [ ] `supabase_setup_complete.sql` actualizado
- [ ] `README.md` con instrucciones claras
- [ ] `DEPLOYMENT_GUIDE.md` disponible

---

## 🔗 SUPABASE CORS

- [ ] Site URL actualizada en Supabase
- [ ] Redirect URLs incluyen dominio de Vercel
- [ ] `http://localhost:5173` en lista para desarrollo
- [ ] Dominio de producción de Vercel agregado

**Configuración en Supabase:**
```
Settings → API → API Settings

Site URL: https://tu-app.vercel.app

Redirect URLs:
http://localhost:5173/**
https://tu-app.vercel.app/**
```

---

## 🧪 TESTING LOCAL

- [ ] `npm run dev` arranca sin errores
- [ ] Login funciona
- [ ] Dashboard carga
- [ ] Módulo Staff lista usuarios
- [ ] Módulo Clientes permite crear cliente
- [ ] Módulo Proyectos permite crear proyecto
- [ ] IA responde (botón puente o chat)
- [ ] No hay errores en consola del navegador

---

## 🚀 VERCEL DEPLOYMENT

- [ ] Proyecto conectado a GitHub
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Install command: `npm install`
- [ ] Variables de entorno configuradas
- [ ] Deploy exitoso
- [ ] URL de producción accesible

---

## ✅ POST-DEPLOYMENT

- [ ] Abrir URL de producción
- [ ] Login funciona en producción
- [ ] Dashboard carga sin errores 404
- [ ] Navegación entre páginas funciona
- [ ] Refresh en cualquier ruta NO da 404
- [ ] Staff page lista usuarios
- [ ] IA funciona en producción

---

## 🐛 DEBUGGING

Si algo falla, revisar en orden:

1. **Consola del navegador** (F12)
   - Errores de red → problema de Supabase
   - Errores de CORS → falta configurar URL en Supabase
   - 404 en rutas → falta `vercel.json`

2. **Logs de Vercel**
   - Dashboard → Deployments → tu deploy → Logs
   - Build errors → problema con dependencias o TypeScript
   - Runtime errors → problema con variables de entorno

3. **Logs de Supabase**
   - Dashboard → Logs → Postgres Logs
   - Errores de auth → problema con trigger
   - Errores de RLS → problema con policies

4. **Network tab del navegador**
   - Ver requests a Supabase
   - Ver headers de auth
   - Ver respuestas de API

---

## 📊 MÉTRICAS DE ÉXITO

Deploy exitoso si:
- ✅ Build time < 2 minutos
- ✅ Bundle size < 1 MB
- ✅ Login funciona
- ✅ Todas las páginas cargan
- ✅ Sin errores 404 en navegación
- ✅ IA responde en < 5 segundos

---

## 🔄 ROLLBACK

Si el deploy falla y necesitás volver atrás:

1. En Vercel Dashboard → Deployments
2. Encontrar el deploy anterior funcional
3. Click en los 3 puntitos
4. "Promote to Production"

---

**Última actualización:** Marzo 2026
