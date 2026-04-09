import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3021,
    proxy: {
      '/api/gateway': {
        target: 'http://127.0.0.1:3011',
        changeOrigin: true,
      },
      '/api/graphify-playground': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
