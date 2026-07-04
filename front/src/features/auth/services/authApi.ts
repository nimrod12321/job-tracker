const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const error = (await response.json()) as { message?: unknown }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }
  } catch {
    // Keep the fallback when the response body is not valid JSON.
  }

  return fallbackMessage
}

export type AuthUser = {
  id: string
  email: string
  createdAt?: string
}

type AuthResponse = {
  token: string
  user: {
    id: string
    email: string
  }
}

export async function registerUser(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to register'))
  }

  return response.json()
}

export async function loginUser(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Failed to login'))
  }

  return response.json()
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Invalid session'))
  }

  return response.json()
}
