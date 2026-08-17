import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendPort = parseInt(process.env.FRONTEND_PORT || '5174', 10);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:43121',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:43121',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
