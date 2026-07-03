import jwt, { type JwtPayload as JsonWebTokenPayload } from 'jsonwebtoken'

type AuthTokenPayload = {
  userId: string
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    throw new Error('JWT_SECRET is not set')
  }

  return secret
}

export function signAuthToken(userId: string) {
  return jwt.sign(
    {
      userId,
    },
    getJwtSecret(),
    {
      expiresIn: '7d',
    },
  )
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret())

  if (typeof decoded === 'string') {
    throw new Error('invalid token payload')
  }

  const payload = decoded as JsonWebTokenPayload

  if (typeof payload.userId !== 'string') {
    throw new Error('invalid token payload')
  }

  return {
    userId: payload.userId,
  }
}