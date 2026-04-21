# rødën OS - Sistema Operativo de Gestión Inteligente

Sistema completo de gestión operativa para talleres de muebles a medida.

**Stack:** React 19 + TypeScript + Vite 6 + Supabase + Google Gemini AI  
**Deploy:** Vercel  
**Base de datos:** PostgreSQL (Supabase)

---

## 🚀 SETUP RÁPIDO

### 1. Clonar y configurar

```bash
# Clonar el repositorio
git clone <tu-repo>
cd roden-os

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
```

### 2. Configurar Supabase

#### 2.1. Crear proyecto en Supabase
1. Ir a https://supabase.com y crear un nuevo proyecto
2. Guardar la contraseña de la base de datos

#### 2.2. Ejecutar el script de setup
1. Abrir Supabase → SQL Editor
2. Copiar TODO el contenido de `supabase_setup_complete.sql`
3. Ejecutarlo en el SQL Editor
4. **IMPORTANTE:** Al final del script, hay un INSERT comentado para crear tu usuario admin. Ejecutá este query para obtener tu UUID:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'tu-email@ejemplo.com';
   ```
5. Usá ese UUID para ejecutar el INSERT de tu usuario administrador

#### 2.3. Configurar variables de entorno
1. En Supabase → Settings → API, copiar:
   - Project URL
   - anon public key
2. Pegar en `.env`:
   ```
   VITE_SUPABASE_URL=tu-project-url
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

### 3. Configurar Google Gemini AI (opcional pero recomendado)

1. Ir a https://aistudio.google.com/apikey
2. Crear una API key
3. Agregar a `.env`:
   ```
   VITE_GEMINI_API_KEY=tu-gemini-api-key
   ```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

La aplicación estará en `http://localhost:5173`

### 5. Deploy a Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Durante el setup:
# - Build Command: npm run build
# - Output Directory: dist
# - Install Command: npm install
```

Luego, en el dashboard de Vercel:
1. Settings → Environment Variables
2. Agregar las 3 variables de `.env`
3. Redeploy

---

## 📋 ESTRUCTURA DEL PROYECTO

```
├── App.tsx                     # Raíz - Estado global, auth, routing
├── types.ts                    # Tipos TypeScript (fuente de verdad)
├── components/
│   ├── Sidebar.tsx            # Navegación lateral
│   ├── RodenAIButton.tsx      # Botón de análisis IA contextual
│   └── MetricCard.tsx         # Tarjetas de métricas
├── pages/
│   ├── Dashboard.tsx          # Panel principal
│   ├── Clients.tsx            # Gestión de clientes
│   ├── Projects.tsx           # Gestión de proyectos
│   ├── CostEstimator.tsx      # Estimador de costos (4200 líneas)
│   ├── Production.tsx         # Vista de taller
│   ├── Tasks.tsx              # Tareas
│   ├── Staff.tsx              # Usuarios y roles
│   ├── SupplierPayments.tsx   # Proveedores y pagos
│   ├── Reports.tsx            # Informes
│   ├── Settings.tsx           # Configuración
│   ├── Archive.tsx            # Archivo de obras
│   ├── AIAssistant.tsx        # Chat IA libre
│   └── Login.tsx              # Login
├── services/
│   ├── supabaseClient.ts      # Cliente de Supabase
│   └── geminiService.ts       # Servicio de IA
├── utils/
│   ├── costEngine.ts          # Motor de cálculo de costos
│   ├── cutOptimizer.ts        # Optimizador de corte
│   └── dataMapper.ts          # Mapeo de datos
└── supabase_setup_complete.sql # Setup completo de BD
```

---

## 🔐 ROLES Y PERMISOS

### Administrador (`administrador`)
- Acceso total al sistema
- Único con acceso a: Staff, Finanzas, IA

### Gerente de Taller (`gerente_taller`)
- Proyectos (solo lectura en producción)
- Taller (edición de avances)
- Tareas (gestión completa)
- Informes (lectura)

### Operario de Taller (`operario_taller`)
- Taller (solo lectura)
- Tareas asignadas (gestión)
- Sin acceso a finanzas ni clientes

---

## 🐛 BUGS CONOCIDOS RESUELTOS

### ✅ Staff page no listaba usuarios
**Causa:** Faltaba policy RLS para lectura de `public.users`  
**Fix:** Incluido en `supabase_setup_complete.sql`

### ✅ Price lists no se guardaban
**Causa:** Faltaban columnas `settings` en `price_lists` y `priceListId` en `saved_estimates`  
**Fix:** Incluido en `supabase_setup_complete.sql`

### ✅ Usuarios no se creaban automáticamente
**Causa:** Faltaba trigger `on_auth_user_created`  
**Fix:** Incluido en `supabase_setup_complete.sql`

---

## 📚 DOCUMENTACIÓN TÉCNICA

- **ARQUITECTURA.md:** Guía completa de la arquitectura del sistema
- **ROLES_PERMISSIONS.md:** Matriz de acceso por rol
- **INSTRUCCIONES_SUPABASE.md:** Setup de Supabase
- **services/ANALISIS_PROBLEMAS.md:** Análisis de bugs conocidos

---

## 🆘 PROBLEMAS COMUNES

### No puedo hacer login
1. Verificá que ejecutaste `supabase_setup_complete.sql`
2. Creá un usuario en Supabase → Authentication → Add User
3. Ejecutá el query de inserción de usuario administrador (ver paso 2.2)

### La IA no responde
1. Verificá que tenés `VITE_GEMINI_API_KEY` en `.env`
2. Verificá que la variable está en Vercel (si es deploy de producción)

### Error en fetchData
1. Verificá que todas las tablas existen en Supabase
2. Verificá que las RLS policies están activas
3. Revisá la consola del navegador para errores específicos

---

## 📄 LICENCIA

Propiedad de Gustavo Polack / rødën
