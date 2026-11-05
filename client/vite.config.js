import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
  },
  server: {
    port: 5173,
    host: true,
    fs: { allow: ['..'] }, // общие константы лежат в корне проекта
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/media': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: proxyTarget,
        changeOrigin: false, // сервер сравнивает Origin с Host
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (['ECONNREFUSED', 'ECONNABORTED', 'ECONNRESET'].includes(err?.code)) return;
            console.error('[proxy]', err.message);
          });
        },
      },
    },
  },
});
