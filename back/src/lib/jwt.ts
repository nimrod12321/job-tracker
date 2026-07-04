import jwt, { type JwtPayload as JsonWebTokenPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'

type AuthTokenPayload = {
  userId: string
}

export function signAuthToken(userId: string) {
  return jwt.sign(
    {
      userId,
    },
    env.jwtSecret,
    {
      expiresIn: '7d',
    },
  )
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret)

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
