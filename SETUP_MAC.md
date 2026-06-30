# Setup en Mac — rødën OS

Pasos para dejar el proyecto andando en una Mac nueva y empezar a trabajar desde Claude.

## 1. Herramientas base (una sola vez)

Abrí la app **Terminal** y pegá:

```bash
# Homebrew (si no lo tenés)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Git, Node 18+ y GitHub CLI
brew install git node gh
```

Verificá versiones (Node debe ser 18 o superior):

```bash
node -v
git --version
```

## 2. Autenticarte en GitHub (una sola vez)

```bash
gh auth login
```

Elegí: **GitHub.com → HTTPS → Login with a web browser**. Seguí el link y autorizá.
Esto deja las credenciales guardadas para todos los `clone`/`pull`/`push` futuros.

## 3. Clonar el proyecto

```bash
cd ~/Documents
git clone https://github.com/gustavopolack-blip/roden.git
cd roden
```

## 4. Configurar entorno e instalar

```bash
cp .env.example .env
npm install
```

## 5. Correr en local

```bash
npm run dev
```

Abre en `http://localhost:5173`.

## 6. Conectar Claude a la carpeta

En Claude (Cowork) en la Mac, seleccioná la carpeta `~/Documents/roden` como carpeta de
trabajo. Claude va a leer `CLAUDE.md` automáticamente y va a tener todo el contexto del
proyecto.

## Rutina diaria (desde acá en adelante)

```bash
git pull                 # ANTES de empezar a trabajar
# ...trabajás...
git add .
git commit -m "qué cambié"
git push origin main     # AL TERMINAR, siempre
```

Pushear a `main` además dispara el deploy automático en Vercel.

## Lo que NO viaja por git (verificá en la Mac)

- **Conectores/MCPs** (Supabase, Gemini, Vercel, etc.): siguen a tu cuenta de Claude, no a
  la máquina. Iniciá sesión con la misma cuenta y verificá que aparezcan.
- **Skills propias** (ej. `roden-propuesta`): si no aparecen, reinstalalas en la Mac.
