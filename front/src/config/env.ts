const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')

if (import.meta.env.PROD && !configuredApiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not set')
}

export const API_BASE_URL =
  configuredApiBaseUrl || 'http://localhost:4000/api'

export const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || ''

export const ENABLE_JOB_MAP =
  import.meta.env.VITE_ENABLE_JOB_MAP?.trim().toLowerCase() === 'true'

export const ENABLE_DEVELOPMENT_JOB_BOARD =
  import.meta.env.DEV &&
  import.meta.env.VITE_ENABLE_JOB_BOARD?.trim().toLowerCase() === 'true'
