// frontend/config-overrides.js
const path = require('path');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');

module.exports = function override(config) {
  // Erlaube Imports außerhalb von src/
  config.resolve.plugins = config.resolve.plugins.filter(
    plugin => !(plugin instanceof ModuleScopePlugin)
  );
  
  // Alias konfigurieren
  config.resolve.alias = {
    ...config.resolve.alias,
    '@premium-frontend': path.resolve(__dirname, '../premium/frontendPRO/src')
  };
  
  return config;
};