# 🚀 GUÍA DE DEPLOYMENT RÁPIDO - rødën OS

Esta guía te lleva de 0 a producción en menos de 30 minutos.

---

## PASO 1: Supabase Setup (10 minutos)

### 1.1. Crear proyecto
1. Ir a https://supabase.com
2. Click en "New Project"
3. Elegir nombre: `roden-os`
4. Elegir región: South America (más cercana)
5. Crear contraseña fuerte y **guardarla**
6. Esperar a que se cree el proyecto

### 1.2. Ejecutar SQL de setup
1. En Supabase, ir a **SQL Editor**
2. Click en "New Query"
3. Abrir el archivo `supabase_setup_complete.sql` de este proyecto
4. Copiar **TODO** el contenido
5. Pegarlo en el SQL Editor de Supabase
6. Click en **"Run"** (abajo a la derecha)
7. Esperar confirmación (puede tardar 10-15 segundos)

### 1.3. Crear tu usuario administrador
1. En Supabase, ir a **Authentication** → **Users**
2. Click en "Add User" → "Create new user"
3. Email: `gustavopolack@gmail.com` (o el que uses)
4. Password: crear una segura
5. Click "Create User"
6. Copiar el **UUID** del usuario recién creado
7. Volver al **SQL Editor**
8. Ejecutar este query (reemplazando el UUID):

```sql
INSERT INTO public.users (id, name, email, role, status)
VALUES (
  'PEGAR-UUID-AQUI',
  'Gustavo Polack',
  'gustavopolack@gmail.com',
  'administrador',
  'ACTIVE'
)
ON CONFLICT (id) DO UPDATE SET role = 'administrador';
```

### 1.4. Obtener credenciales
1. En Supabase, ir a **Settings** → **API**
2. Copiar estos dos valores:
   - **Project URL**
   - **anon public key**
3. Los vas a necesitar en el próximo paso

---

## PASO 2: Clonar y configurar el proyecto (5 minutos)

```bash
# 1. Clonar el repo (o copiar los archivos)
cd ~/Desktop
mkdir roden-os
cd roden-os
# (copiar todos los archivos del ZIP acá)

# 2. Instalar dependencias
npm install

# 3. Crear archivo .env
cp .env.example .env

# 4. Editar .env con tus credenciales
# Abrir .env en tu editor y pegar:
```

Archivo `.env`:
```env
VITE_SUPABASE_URL=PEGAR-PROJECT-URL-AQUI
VITE_SUPABASE_ANON_KEY=PEGAR-ANON-KEY-AQUI
VITE_GEMINI_API_KEY=PEGAR-TU-GEMINI-KEY-AQUI
```

Para obtener la Gemini API Key:
1. Ir a https://aistudio.google.com/apikey
2. Click "Create API Key"
3. Copiar la key y pegarla en `.env`

---

## PASO 3: Probar localmente (2 minutos)

```bash
# Ejecutar en modo desarrollo
npm run dev

# Abrir navegador en http://localhost:5173
# Login con el email y password que creaste
```

**Si todo funciona:**
- ✅ Podés hacer login
- ✅ Ves el dashboard vacío
- ✅ Podés navegar entre módulos
- ✅ No hay errores en la consola

**Si hay problemas:** ver sección "Troubleshooting" abajo.

---

## PASO 4: Deploy a Vercel (5 minutos)

### 4.1. Preparar el proyecto para Git

```bash
# Inicializar Git
git init
git add .
git commit -m "Initial commit - rødën OS"

# Crear repo en GitHub
# 1. Ir a github.com
# 2. Click en "New Repository"
# 3. Nombre: roden-os
# 4. Privado o público (recomendado privado)
# 5. NO inicializar con README
# 6. Crear

# Conectar y pushear
git remote add origin https://github.com/TU-USUARIO/roden-os.git
git branch -M main
git push -u origin main
```

### 4.2. Deploy en Vercel

1. Ir a https://vercel.com
2. Click "Add New" → "Project"
3. Importar tu repo de GitHub `roden-os`
4. **Build Settings:**
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. **Environment Variables:** Click "Add" para cada una:
   - `VITE_SUPABASE_URL` = [tu-project-url]
   - `VITE_SUPABASE_ANON_KEY` = [tu-anon-key]
   - `VITE_GEMINI_API_KEY` = [tu-gemini-key]
6. Click **"Deploy"**
7. Esperar 2-3 minutos

### 4.3. Configurar dominio en Supabase (IMPORTANTE)

1. Una vez deployado, Vercel te da una URL: `roden-os-xxx.vercel.app`
2. Ir a Supabase → **Settings** → **API** → **API Settings**
3. Scroll hasta "Site URL"
4. Cambiar de `http://localhost:3000` a tu URL de Vercel
5. Scroll hasta "Redirect URLs"
6. Agregar: `https://roden-os-xxx.vercel.app/**` (con los asteriscos)
7. **Save**

---

## PASO 5: Verificar producción

1. Abrir la URL de Vercel que te dio
2. Login con tu usuario
3. Probar:
   - ✅ Dashboard
   - ✅ Crear un cliente
   - ✅ Crear un proyecto
   - ✅ IA (botón puente o chat)

**Si funciona todo:** ¡Listo! Ya tenés rødën OS en producción.

---

## 🔧 TROUBLESHOOTING

### Error: "Invalid login credentials"
- Verificá que el email sea EXACTAMENTE el que usaste en Supabase Auth
- Verificá que el password sea correcto
- Verificá que ejecutaste el INSERT del usuario administrador

### Error: "Failed to fetch"
- Verificá las variables de entorno en `.env`
- Verificá que `VITE_SUPABASE_URL` empiece con `https://`
- Recargá la página (Ctrl+Shift+R)

### Staff page muestra lista vacía
- Ejecutá en Supabase SQL Editor:
```sql
SELECT * FROM public.users;
```
- Si está vacío, ejecutá el INSERT del usuario admin del PASO 1.3

### IA no responde
- Verificá que `VITE_GEMINI_API_KEY` esté en `.env`
- Verificá que la key sea válida en https://aistudio.google.com/apikey
- Verificá en la consola del navegador si hay errores

### Build falla en Vercel
- Verificá que todas las variables de entorno estén en Vercel
- Verificá que `vercel.json` existe en la raíz
- Verificá los logs de build en Vercel Dashboard

---

## 📞 SOPORTE

Si seguiste todos los pasos y algo no funciona:
1. Revisá la consola del navegador (F12)
2. Revisá los logs de Supabase (Dashboard → Logs)
3. Revisá los logs de Vercel (Dashboard → Deployments → Logs)

---

## 🎉 PRÓXIMOS PASOS

Una vez que tenés el sistema funcionando:
1. Crear clientes de prueba
2. Crear proyectos de prueba
3. Probar el Estimador de Costos
4. Configurar roles para tu equipo
5. Personalizar settings

**Documentación completa:** Ver `ARQUITECTURA.md` y `ROLES_PERMISSIONS.md`
