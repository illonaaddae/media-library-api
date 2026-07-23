import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin in production (static build served alongside the API). In dev,
// proxy API paths to the Express server on :3000 so the UI needs no CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/media': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
  build: { outDir: 'dist' },
});
