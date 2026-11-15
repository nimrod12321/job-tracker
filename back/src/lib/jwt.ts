import jwt, { type JwtPayload as JsonWebTokenPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'

type AuthTokenPayload = {
  userId: string
  authMethod?: 'otp'
  ownerAcquisitionId?: string
  ownerAcquisitionFlow?: 'selfServe' | 'claim' | 'pendingPhone'
}

export type RegistrationCompletionTokenPayload = {
  userId: string
  tokenUse: 'registrationCompletion'
  ownerAcquisitionId?: string
  ownerAcquisitionFlow?: 'selfServe' | 'claim' | 'pendingPhone'
}

type SignAuthTokenOptions = Omit<AuthTokenPayload, 'userId'>

export function signAuthToken(
  userId: string,
  options: SignAuthTokenOptions = {},
) {
  return jwt.sign(
    {
      userId,
      ...options,
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

  if (
    typeof payload.userId !== 'string' ||
    payload.tokenUse !== undefined
  ) {
    throw new Error('invalid token payload')
  }

  return {
    userId: payload.userId,
    ...(payload.authMethod === 'otp'
      ? { authMethod: payload.authMethod }
      : {}),
    ...(typeof payload.ownerAcquisitionId === 'string'
      ? { ownerAcquisitionId: payload.ownerAcquisitionId }
      : {}),
    ...(payload.ownerAcquisitionFlow === 'selfServe' ||
    payload.ownerAcquisitionFlow === 'claim' ||
    payload.ownerAcquisitionFlow === 'pendingPhone'
      ? { ownerAcquisitionFlow: payload.ownerAcquisitionFlow }
      : {}),
  }
}

export function signRegistrationCompletionToken(
  userId: string,
  options: Omit<
    RegistrationCompletionTokenPayload,
    'userId' | 'tokenUse'
  > = {},
) {
  return jwt.sign(
    {
      userId,
      tokenUse: 'registrationCompletion',
      ...options,
    },
    env.jwtSecret,
    { expiresIn: '15m' },
  )
}

export function verifyRegistrationCompletionToken(
  token: string,
): RegistrationCompletionTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret)

  if (typeof decoded === 'string') {
    throw new Error('invalid token payload')
  }

  const payload = decoded as JsonWebTokenPayload

  if (
    typeof payload.userId !== 'string' ||
    payload.tokenUse !== 'registrationCompletion'
  ) {
    throw new Error('invalid token payload')
  }

  return {
    userId: payload.userId,
    tokenUse: 'registrationCompletion',
    ...(typeof payload.ownerAcquisitionId === 'string'
      ? { ownerAcquisitionId: payload.ownerAcquisitionId }
      : {}),
    ...(payload.ownerAcquisitionFlow === 'selfServe' ||
    payload.ownerAcquisitionFlow === 'claim' ||
    payload.ownerAcquisitionFlow === 'pendingPhone'
      ? { ownerAcquisitionFlow: payload.ownerAcquisitionFlow }
      : {}),
  }
}
