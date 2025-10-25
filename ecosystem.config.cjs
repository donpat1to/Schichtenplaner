// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'schichtplan-app',
    script: './dist/server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3002,
      FRONTEND_BUILD_PATH: './frontend-build'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};