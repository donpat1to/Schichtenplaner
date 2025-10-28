import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory
  const env = loadEnv(mode, process.cwd(), '')
  
  // Only expose specific environment variables to the client
  const clientEnv = {
    NODE_ENV: mode,
    ENABLE_PRO: env.ENABLE_PRO || 'false',
    VITE_APP_TITLE: env.VITE_APP_TITLE || 'Shift Planning App',
    // Add other client-safe variables here
  }
  
  return {
    plugins: [react()],
    server: {
      port: 3003,
      host: true,
      open: mode === 'development',
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: mode === 'production' ? {
        compress: {
          drop_console: true,
        },
      } : undefined,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@/components': resolve(__dirname, './src/components'),
        '@/pages': resolve(__dirname, './src/pages'),
        '@/contexts': resolve(__dirname, './src/contexts'),
        '@/models': resolve(__dirname, './src/models'),
        '@/utils': resolve(__dirname, './src/utils'),
        '@/services': resolve(__dirname, './src/services'),
        '@/design': resolve(__dirname, './src/design')
      }
    },
    // ✅ SICHER: Nur explizit definierte Variablen
    define: Object.keys(clientEnv).reduce((acc, key) => {
      acc[`process.env.${key}`] = JSON.stringify(clientEnv[key])
      return acc
    }, {} as Record<string, string>)
  }
})