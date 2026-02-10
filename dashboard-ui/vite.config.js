import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',
  server: {
    port: 3000,
    proxy: {
      '/api/hedera': {
        target: 'https://testnet.mirrornode.hedera.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hedera/, '/api/v1'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'motion-vendor': ['framer-motion'],
        },
      },
    },
  },
})
