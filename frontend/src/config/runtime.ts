export interface RuntimeConfig {
  APP_URL: string;
  ENABLE_PRO: boolean;
  FORCE_HTTPS: boolean;
  API_URL: string;
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
  }
}

function getConfig(): RuntimeConfig {
  const windowConfig = window.__RUNTIME_CONFIG__ || {};
  const isDev = import.meta.env.DEV;

  return {
    APP_URL: windowConfig.APP_URL ?? (isDev ? 'http://localhost:3002' : window.location.origin),
    ENABLE_PRO: windowConfig.ENABLE_PRO ?? (import.meta.env.ENABLE_PRO === 'true'),
    FORCE_HTTPS: windowConfig.FORCE_HTTPS ?? (import.meta.env.FORCE_HTTPS === 'true'),
    API_URL: windowConfig.API_URL ?? (import.meta.env.VITE_API_URL || '/api'),
  };
}

export const config: RuntimeConfig = Object.freeze(getConfig());
export const { APP_URL, ENABLE_PRO, FORCE_HTTPS, API_URL } = config;
