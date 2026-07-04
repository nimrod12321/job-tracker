const configuredApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')

if (import.meta.env.PROD && !configuredApiBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not set')
}

export const API_BASE_URL =
  configuredApiBaseUrl || 'http://localhost:4000/api'
