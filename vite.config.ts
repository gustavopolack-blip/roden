import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

// Sello de versión visible en la app: commit (Vercel lo expone en el build) + fecha de build.
const gitSha = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try { return execSync('git rev-parse HEAD').toString().trim(); } catch { return 'local'; }
})();

export default defineConfig({
  base: '/os/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  define: {
    __APP_VERSION__: JSON.stringify(gitSha.slice(0, 7)),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
