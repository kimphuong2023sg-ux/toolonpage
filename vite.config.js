import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true, // Cho phép tất cả host (bao gồm 5173michael.kjctech.space, cloudflare tunnel...)
    watch: {
      ignored: ['**/content/**', '**/data/**', '**/.git/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 120000
      },
      '/local-media': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 120000
      }
    }
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: [
      '5173michael.kjctech.space',
      '.kjctech.space'
    ]
  }
});
