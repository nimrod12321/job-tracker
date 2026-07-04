const AUTH_TOKEN_KEY = 'job-tracker-auth-token'

export const AUTH_SESSION_EXPIRED_EVENT = 'auth-session-expired'

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function saveAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function notifyAuthSessionExpired() {
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT))
}