// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'backend',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/backend-err.log',
      out_file: './logs/backend-out.log',
      time: true
    },
    {
      name: 'frontend',
      script: 'npx',
      args: 'serve -s frontend-build -l 3000',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/frontend-err.log',
      out_file: './logs/frontend-out.log',
      time: true
    }
  ]
};