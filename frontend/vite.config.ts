import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Security-focused Vite configuration
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  const isDevelopment = mode === 'development'
  
  // Load environment variables securely
  const env = loadEnv(mode, process.cwd(), '')
  
  // Strictly defined client-safe environment variables
  const clientEnv = {
    NODE_ENV: mode,
    ENABLE_PRO: env.ENABLE_PRO || 'false',
    VITE_APP_TITLE: env.VITE_APP_TITLE || 'Shift Planning App',
    VITE_API_URL: isProduction ? '/api' : 'http://localhost:3002/api',
    // Explicitly define only what's needed - no dynamic env variables
  }

  return {
    plugins: [
      react({
        // React specific security settings
        jsxRuntime: 'automatic',
        babel: {
          plugins: [
            // Remove console in production
            isProduction && ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }]
          ].filter(Boolean)
        }
      })
    ],
    
    server: {
      port: 3003,
      host: true,
      open: isDevelopment,
      // Security headers for dev server
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), location=()'
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          // Additional proxy security
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err)
            })
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request to the Target:', req.method, req.url)
            })
          }
        }
      },
      // Security: disable HMR in non-dev environments
      hmr: isDevelopment
    },
    
    build: {
      outDir: 'dist',
      // Security: No source maps in production
      sourcemap: isDevelopment ? 'inline' : false,
      // Generate deterministic hashes for better caching and security
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          // Security: Use content hashes for cache busting and integrity
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          // Security: Manual chunks to separate vendor code
          manualChunks: {
            vendor: ['react', 'react-dom'],
            router: ['react-router-dom'],
            utils: ['lodash', 'date-fns']
          }
        }
      },
      // Minification with security-focused settings
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          // Security: Remove potentially sensitive code
          pure_funcs: [
            'console.log',
            'console.info',
            'console.debug',
            'console.warn',
            'console.trace',
            'console.table',
            'debugger'
          ],
          dead_code: true,
          unused: true,
          joins: true,
          if_return: true,
          comparisons: true,
          loops: true,
          hoist_funs: true,
          hoist_vars: true,
          reduce_vars: true
        },
        mangle: {
          // Security: Obfuscate code
          toplevel: true,
          keep_classnames: false,
          keep_fnames: false,
          reserved: [
            'React',
            'ReactDOM',
            'useState',
            'useEffect',
            'useContext',
            'createElement'
          ]
        },
        format: {
          comments: false,
          beautify: false,
          // Security: ASCII only to prevent encoding attacks
          ascii_only: true
        }
      } : undefined,
      // Security: Report bundle size issues
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000,
      // Security: Don't expose source paths
      assetsInlineLimit: 4096
    },
    
    preview: {
      port: 3004,
      headers: {
        // Security headers for preview server
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': `
          default-src 'self';
          script-src 'self' 'unsafe-inline';
          style-src 'self' 'unsafe-inline';
          img-src 'self' data: https:;
          font-src 'self';
          connect-src 'self';
          base-uri 'self';
          form-action 'self';
          frame-ancestors 'none';
        `.replace(/\s+/g, ' ').trim()
      }
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
    
    // ✅ SICHER: Strict environment variable control
    define: Object.keys(clientEnv).reduce((acc, key) => {
      acc[`import.meta.env.${key}`] = JSON.stringify(clientEnv[key])
      return acc
    }, {} as Record<string, string>),
    
    // Security: Clear build directory
    emptyOutDir: true,
    
    // Security: Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
      exclude: ['@vitejs/plugin-react']
    },
    
    // Security: CSS configuration
    css: {
      devSourcemap: isDevelopment,
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: isProduction 
          ? '[hash:base64:8]' 
          : '[name]__[local]--[hash:base64:5]'
      }
    }
  }
})