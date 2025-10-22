// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'schichtplaner',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/app-err.log',
      out_file: './logs/app-out.log',
      time: true
    }
  ]
};