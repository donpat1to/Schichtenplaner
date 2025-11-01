// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'

  const env = loadEnv(mode, process.cwd(), '')

  // 🆕 WICHTIG: Relative Pfade für Production
  const clientEnv = {
    NODE_ENV: mode,
    ENABLE_PRO: env.ENABLE_PRO || 'false',
    VITE_APP_TITLE: env.APP_TITLE || 'Shift Planning App',
    VITE_API_URL: isProduction ? '/api' : '/api',
  }

  return {
    plugins: [react()],

    server: isDevelopment ? {
      port: 3003,
      host: true,
      open: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        }
      }
    } : undefined,

    build: {
      outDir: 'dist',
      sourcemap: isDevelopment,
      base: isProduction ? '/' : '/',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        }
      },
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug', 'console.info']
        }
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

    define: Object.keys(clientEnv).reduce((acc, key) => {
      acc[`import.meta.env.${key}`] = JSON.stringify(clientEnv[key])
      return acc
    }, {} as Record<string, string>)
  }
})