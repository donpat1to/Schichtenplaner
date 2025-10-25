/// <reference types="vite/client" />

// Define types for environment variables
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly ENABLE_PRO: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}