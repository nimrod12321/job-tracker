/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_ENABLE_JOB_MAP?: string
  readonly VITE_ENABLE_JOB_BOARD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
