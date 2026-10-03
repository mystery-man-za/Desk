import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.FRONTEND_PORT ?? 3001),
    strictPort: true,
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? `http://127.0.0.1:${process.env.API_PORT ?? 3002}`,
    },
  },
});
