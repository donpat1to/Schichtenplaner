import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    // Development proxy
    server: isProduction ? undefined : {
      port: 3003,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
        }
      }
    },

    // Production build optimized for Express serving
    build: {
      outDir: 'dist',
      sourcemap: false, // Disable in production
      minify: 'terser',
      
      // Bundle optimization
      rollupOptions: {
        output: {
          // Efficient chunking
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            utils: ['date-fns']
          },
          // Cache-friendly naming
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        }
      },
      
      // Performance optimizations
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.debug']
        }
      },
      
      // Reduce chunking overhead
      chunkSizeWarningLimit: 800
    },

    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        // ... other aliases
      }
    },

    // Environment variables
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(isProduction ? '/api' : '/api'),
      'import.meta.env.ENABLE_PRO': JSON.stringify(env.ENABLE_PRO || 'false'),
      'import.meta.env.NODE_ENV': JSON.stringify(mode)
    }
  }
})