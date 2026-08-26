import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/auth': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/weather-data': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '^/log-details(?!-)': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/filters': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '^/user(?!-)': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/health': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/sn-overview': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/sn-branch-assignments': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/battery-overview': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/transition-distance': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/lte-analysis': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '^/general-overview(?!-)': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/operation-type': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/data-freshness': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/performance': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/job-config': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/job-execution': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
      '/blob-sync': { target: 'http://localhost:3000', changeOrigin: true, secure: false },
    },
  },
});
