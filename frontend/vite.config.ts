// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@premium-frontend': resolve(__dirname, '../premium/frontendPRO/src')
    }
  },
  define: {
    'process.env.ENABLE_PRO': JSON.stringify(process.env.ENABLE_PRO === 'true')
  }
});