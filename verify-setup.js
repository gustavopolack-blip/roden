#!/usr/bin/env node

/**
 * VERIFICADOR DE SETUP - rødën OS
 * 
 * Ejecutar con: node verify-setup.js
 * 
 * Este script verifica que tu proyecto esté correctamente configurado
 * antes de hacer el deploy.
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 VERIFICADOR DE SETUP - rødën OS\n');
console.log('='.repeat(50) + '\n');

let errors = 0;
let warnings = 0;

// Función auxiliar para verificar archivos
function checkFile(filePath, description, critical = true) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    console.log(`✅ ${description}`);
    return true;
  } else {
    if (critical) {
      console.log(`❌ ${description} - FALTA`);
      errors++;
    } else {
      console.log(`⚠️  ${description} - FALTA (opcional)`);
      warnings++;
    }
    return false;
  }
}

// Función para verificar contenido de archivo
function checkFileContains(filePath, searchString, description) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${description} - ARCHIVO FALTA`);
    errors++;
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(searchString)) {
    console.log(`✅ ${description}`);
    return true;
  } else {
    console.log(`⚠️  ${description} - NO ENCONTRADO`);
    warnings++;
    return false;
  }
}

// 1. ARCHIVOS CRÍTICOS
console.log('📁 ARCHIVOS CRÍTICOS\n');
checkFile('package.json', 'package.json existe');
checkFile('vercel.json', 'vercel.json existe');
checkFile('index.html', 'index.html existe');
checkFile('App.tsx', 'App.tsx existe');
checkFile('types.ts', 'types.ts existe');
checkFile('supabase_setup_complete.sql', 'supabase_setup_complete.sql existe');
console.log('');

// 2. ESTRUCTURA DE CARPETAS
console.log('📂 ESTRUCTURA DE CARPETAS\n');
checkFile('components', 'Carpeta components/', true);
checkFile('pages', 'Carpeta pages/', true);
checkFile('services', 'Carpeta services/', true);
checkFile('utils', 'Carpeta utils/', true);
console.log('');

// 3. COMPONENTES CLAVE
console.log('⚛️  COMPONENTES CLAVE\n');
checkFile('components/Sidebar.tsx', 'Sidebar.tsx');
checkFile('components/RodenAIButton.tsx', 'RodenAIButton.tsx');
checkFile('pages/Dashboard.tsx', 'Dashboard.tsx');
checkFile('pages/CostEstimator.tsx', 'CostEstimator.tsx');
checkFile('pages/Staff.tsx', 'Staff.tsx');
checkFile('services/supabaseClient.ts', 'supabaseClient.ts');
checkFile('services/geminiService.ts', 'geminiService.ts');
console.log('');

// 4. CONFIGURACIÓN
console.log('⚙️  CONFIGURACIÓN\n');

// Verificar .gitignore
if (checkFile('.gitignore', '.gitignore existe')) {
  checkFileContains('.gitignore', '.env', 'gitignore incluye .env');
  checkFileContains('.gitignore', 'node_modules', 'gitignore incluye node_modules');
  checkFileContains('.gitignore', 'dist/', 'gitignore incluye dist/');
}

// Verificar vercel.json
if (checkFile('vercel.json', 'vercel.json existe')) {
  checkFileContains('vercel.json', 'rewrites', 'vercel.json tiene rewrites para SPA');
}

// Verificar .env.example
checkFile('.env.example', '.env.example existe', false);

// Verificar si .env existe (warning si no está)
if (!fs.existsSync('.env')) {
  console.log('⚠️  .env NO existe - Creá uno copiando .env.example');
  warnings++;
} else {
  console.log('✅ .env existe');
  
  // Verificar contenido de .env
  const envContent = fs.readFileSync('.env', 'utf8');
  
  if (envContent.includes('VITE_SUPABASE_URL=')) {
    console.log('✅ VITE_SUPABASE_URL presente en .env');
  } else {
    console.log('❌ VITE_SUPABASE_URL FALTA en .env');
    errors++;
  }
  
  if (envContent.includes('VITE_SUPABASE_ANON_KEY=')) {
    console.log('✅ VITE_SUPABASE_ANON_KEY presente en .env');
  } else {
    console.log('❌ VITE_SUPABASE_ANON_KEY FALTA en .env');
    errors++;
  }
  
  if (envContent.includes('VITE_GEMINI_API_KEY=')) {
    console.log('✅ VITE_GEMINI_API_KEY presente en .env');
  } else {
    console.log('⚠️  VITE_GEMINI_API_KEY FALTA en .env (opcional)');
    warnings++;
  }
}

console.log('');

// 5. PACKAGE.JSON
console.log('📦 DEPENDENCIAS\n');
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  
  const requiredDeps = [
    '@supabase/supabase-js',
    '@google/genai',
    'react',
    'react-dom',
    'lucide-react'
  ];
  
  requiredDeps.forEach(dep => {
    if (pkg.dependencies && pkg.dependencies[dep]) {
      console.log(`✅ ${dep} instalado`);
    } else {
      console.log(`❌ ${dep} FALTA`);
      errors++;
    }
  });
  
  // Verificar scripts
  console.log('');
  if (pkg.scripts && pkg.scripts.build) {
    console.log(`✅ Script 'build' configurado: ${pkg.scripts.build}`);
  } else {
    console.log('❌ Script build FALTA en package.json');
    errors++;
  }
  
  if (pkg.scripts && pkg.scripts.dev) {
    console.log(`✅ Script 'dev' configurado: ${pkg.scripts.dev}`);
  } else {
    console.log('❌ Script dev FALTA en package.json');
    errors++;
  }
}

console.log('');

// 6. DOCUMENTACIÓN
console.log('📚 DOCUMENTACIÓN\n');
checkFile('README.md', 'README.md', false);
checkFile('DEPLOYMENT_GUIDE.md', 'DEPLOYMENT_GUIDE.md', false);
checkFile('DEPLOYMENT_CHECKLIST.md', 'DEPLOYMENT_CHECKLIST.md', false);
checkFile('ARQUITECTURA.md', 'ARQUITECTURA.md', false);
checkFile('ROLES_PERMISSIONS.md', 'ROLES_PERMISSIONS.md', false);

console.log('');
console.log('='.repeat(50));
console.log('');

// RESUMEN
if (errors === 0 && warnings === 0) {
  console.log('🎉 ¡PERFECTO! Todo está en orden.');
  console.log('');
  console.log('Próximos pasos:');
  console.log('1. npm install');
  console.log('2. Configurar .env con tus credenciales');
  console.log('3. npm run dev para probar localmente');
  console.log('4. Seguir DEPLOYMENT_GUIDE.md para deploy a Vercel');
} else {
  console.log(`⚠️  ATENCIÓN: ${errors} errores, ${warnings} advertencias`);
  console.log('');
  if (errors > 0) {
    console.log('❌ Corregí los errores antes de continuar.');
  }
  if (warnings > 0) {
    console.log('⚠️  Las advertencias son opcionales pero recomendadas.');
  }
}

console.log('');
process.exit(errors > 0 ? 1 : 0);
