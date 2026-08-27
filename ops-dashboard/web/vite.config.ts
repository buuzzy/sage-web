import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  server: {
    port: 1421,
    strictPort: true,
    host: true,
    proxy: {
      // Vite dev server proxies /api/* to the Hono backend (port 2027),
      // so the frontend always uses same-origin /api/* URLs.
      '/api': {
        target: 'http://localhost:2027',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});