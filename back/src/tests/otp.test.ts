import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import assert from 'node:assert/strict'
import test from 'node:test'
import 'dotenv/config'
import type { Express } from 'express'

const shouldRunSecurityTests = process.env.RUN_SECURITY_TESTS === 'true'

function normalizeDatabaseUrl(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, '')
}

function assertSafeTestDatabaseUrl() {
  if (!shouldRunSecurityTests) {
    return
  }

  const testDatabaseUrl = normalizeDatabaseUrl(process.env.TEST_DATABASE_URL)
  const regularDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

  if (!testDatabaseUrl) {
    throw new Error(
      'RUN_SECURITY_TESTS=true requires TEST_DATABASE_URL. Refusing to run against DATABASE_URL.',
    )
  }

  if (regularDatabaseUrl && testDatabaseUrl === regularDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL. Refusing to run OTP tests against the normal app database.',
    )
  }

  const parsedUrl = new URL(testDatabaseUrl)
  const normalizedUrl = testDatabaseUrl.toLowerCase()
  const host = parsedUrl.hostname.toLowerCase()
  const clearlyTestDatabase =
    normalizedUrl.includes('test') || normalizedUrl.includes('testing')

  if (
    !clearlyTestDatabase &&
    (normalizedUrl.includes('peepss') ||
      normalizedUrl.includes('production') ||
      normalizedUrl.includes('prod') ||
      host.includes('neon.tech'))
  ) {
    throw new Error(
      'TEST_DATABASE_URL looks production-like. Use a dedicated database with test in the name.',
    )
  }
}

assertSafeTestDatabaseUrl()

type ApiResponse<T> = {
  status: number
  body: T
}

type AuthResponse = {
  token: string
  user: {
    id: string
    email?: string
    phoneNumber: string | null
    phoneVerifiedAt: string | null
    fullName: string
    track: 'highTech' | 'restaurant' | 'restaurantOwner'
    isAdmin: boolean
    createdAt?: string
  }
}

type PrismaModule = typeof import('../lib/prisma.js')
type OtpProviderModule = typeof import('../services/otpProvider.js')

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text()

  return {
    status: response.status,
    body: text ? (JSON.parse(text) as T) : ({} as T),
  }
}

test(
  'phone OTP auth integration tests',
  {
    skip: shouldRunSecurityTests
      ? false
      : 'Set RUN_SECURITY_TESTS=true and TEST_DATABASE_URL to run OTP integration tests.',
  },
  async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'security-test-secret'
    process.env.OTP_CODE_LENGTH = '4'
    process.env.OTP_EXPIRES_MINUTES = '5'
    process.env.OTP_MAX_ATTEMPTS = '5'

    const runId = `otp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`
    const adminPhone = '+972501111111'

    process.env.ADMIN_PHONES = adminPhone
    process.env.ADMIN_EMAILS = ''

    const [{ app }, { prisma }, { getCapturedOtpCodeForTest }] =
      await Promise.all([
        import('../server.js') as Promise<{ app: Express }>,
        import('../lib/prisma.js') as Promise<PrismaModule>,
        import('../services/otpProvider.js') as Promise<OtpProviderModule>,
      ])

    const server = createServer(app)

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    const baseUrl = `http://127.0.0.1:${address.port}/api`
    const createdPhones: string[] = []

    async function request<T>(
      path: string,
      options: RequestInit = {},
    ): Promise<ApiResponse<T>> {
      return readJson<T>(await fetch(`${baseUrl}${path}`, options))
    }

    function jsonHeaders() {
      return {
        'Content-Type': 'application/json',
      }
    }

    async function requestCode(phoneNumber: string, purpose: string) {
      return request<Record<string, unknown>>('/auth/request-code', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({
          phoneNumber,
          purpose,
        }),
      })
    }

    async function verifyCode(body: Record<string, unknown>) {
      return request<AuthResponse>('/auth/verify-code', {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(body),
      })
    }

    try {
      const registerPhone = '+972501234567'
      createdPhones.push(registerPhone)

      const requestedCode = await requestCode('050-123-4567', 'register')
      assert.equal(requestedCode.status, 200)
      assert.deepEqual(requestedCode.body, {
        ok: true,
      })
      assert.equal('code' in requestedCode.body, false)

      const capturedCode = getCapturedOtpCodeForTest(
        registerPhone,
        'register',
      )
      assert.match(capturedCode ?? '', /^\d{4}$/)

      const otp = await prisma.otpVerification.findFirstOrThrow({
        where: {
          phoneNumber: registerPhone,
          purpose: 'register',
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      assert.equal(otp.phoneNumber, registerPhone)
      assert.notEqual(otp.codeHash, capturedCode)

      const wrongCode =
        capturedCode === '0000' ? '0001' : '0000'
      const wrongCodeResponse = await verifyCode({
        phoneNumber: registerPhone,
        code: wrongCode,
        purpose: 'register',
        fullName: 'Wrong Code',
        track: 'restaurant',
      })
      assert.equal(wrongCodeResponse.status, 400)

      const otpAfterWrongAttempt =
        await prisma.otpVerification.findUniqueOrThrow({
          where: {
            id: otp.id,
          },
        })
      assert.equal(otpAfterWrongAttempt.attempts, 1)

      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await verifyCode({
          phoneNumber: registerPhone,
          code: wrongCode,
          purpose: 'register',
          fullName: 'Wrong Code',
          track: 'restaurant',
        })
        assert.equal(response.status, 400)
      }

      const blockedAfterMaxAttempts = await verifyCode({
        phoneNumber: registerPhone,
        code: capturedCode,
        purpose: 'register',
        fullName: 'Blocked User',
        track: 'restaurant',
      })
      assert.equal(blockedAfterMaxAttempts.status, 400)

      const newCodePhone = '+972502222222'
      createdPhones.push(newCodePhone)
      await requestCode(newCodePhone, 'register')
      const oldOtp = await prisma.otpVerification.findFirstOrThrow({
        where: {
          phoneNumber: newCodePhone,
          purpose: 'register',
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
      await requestCode(newCodePhone, 'register')
      const invalidatedOtp =
        await prisma.otpVerification.findUniqueOrThrow({
          where: {
            id: oldOtp.id,
          },
        })
      assert.ok(invalidatedOtp.consumedAt)

      const newCode = getCapturedOtpCodeForTest(
        newCodePhone,
        'register',
      )
      assert.ok(newCode)
      const registeredUser = await verifyCode({
        phoneNumber: newCodePhone,
        code: newCode,
        purpose: 'register',
        fullName: 'Phone User',
        track: 'restaurant',
      })
      assert.equal(registeredUser.status, 200)
      assert.ok(registeredUser.body.token)
      assert.equal(registeredUser.body.user.phoneNumber, newCodePhone)
      assert.equal(registeredUser.body.user.fullName, 'Phone User')
      assert.equal(registeredUser.body.user.track, 'restaurant')
      assert.ok(registeredUser.body.user.phoneVerifiedAt)

      const storedUser = await prisma.user.findUniqueOrThrow({
        where: {
          phoneNumber: newCodePhone,
        },
      })
      assert.equal(storedUser.passwordHash, null)

      await requestCode(newCodePhone, 'login')
      const loginCode = getCapturedOtpCodeForTest(newCodePhone, 'login')
      assert.ok(loginCode)
      const loginResponse = await verifyCode({
        phoneNumber: newCodePhone,
        code: loginCode,
        purpose: 'login',
      })
      assert.equal(loginResponse.status, 200)
      assert.equal(loginResponse.body.user.id, registeredUser.body.user.id)

      const missingUserPhone = '+972503333333'
      createdPhones.push(missingUserPhone)
      await requestCode(missingUserPhone, 'login')
      const missingUserLoginCode = getCapturedOtpCodeForTest(
        missingUserPhone,
        'login',
      )
      assert.ok(missingUserLoginCode)
      const missingUserLogin = await verifyCode({
        phoneNumber: missingUserPhone,
        code: missingUserLoginCode,
        purpose: 'login',
      })
      assert.equal(missingUserLogin.status, 404)
      assert.equal(
        await prisma.user.count({
          where: {
            phoneNumber: missingUserPhone,
          },
        }),
        0,
      )

      const highTechPhone = '+972504444444'
      createdPhones.push(highTechPhone)
      await requestCode(highTechPhone, 'register')
      const highTechCode = getCapturedOtpCodeForTest(
        highTechPhone,
        'register',
      )
      assert.ok(highTechCode)
      const highTechRegister = await verifyCode({
        phoneNumber: highTechPhone,
        code: highTechCode,
        purpose: 'register',
        fullName: 'High Tech User',
        track: 'highTech',
      })
      assert.equal(highTechRegister.status, 400)

      createdPhones.push(adminPhone)
      await requestCode(adminPhone, 'register')
      const adminCode = getCapturedOtpCodeForTest(adminPhone, 'register')
      assert.ok(adminCode)
      const adminRegister = await verifyCode({
        phoneNumber: adminPhone,
        code: adminCode,
        purpose: 'register',
        fullName: 'Admin Phone',
        track: 'restaurantOwner',
      })
      assert.equal(adminRegister.status, 200)
      assert.equal(adminRegister.body.user.isAdmin, true)

      const qrApplyPhone = '+972506666666'
      createdPhones.push(qrApplyPhone)
      const qrApplyRequest = await requestCode(qrApplyPhone, 'qrApply')
      assert.equal(qrApplyRequest.status, 200)
      const qrApplyCode = getCapturedOtpCodeForTest(
        qrApplyPhone,
        'qrApply',
      )
      assert.ok(qrApplyCode)
      const qrApplyRegister = await verifyCode({
        phoneNumber: qrApplyPhone,
        code: qrApplyCode,
        purpose: 'qrApply',
        fullName: 'QR Apply User',
      })
      assert.equal(qrApplyRegister.status, 200)
      assert.ok(qrApplyRegister.body.token)
      assert.equal(qrApplyRegister.body.user.phoneNumber, qrApplyPhone)
      assert.equal(qrApplyRegister.body.user.fullName, 'QR Apply User')
      assert.equal(qrApplyRegister.body.user.track, 'restaurant')

      await requestCode(qrApplyPhone, 'qrApply')
      const existingQrApplyCode = getCapturedOtpCodeForTest(
        qrApplyPhone,
        'qrApply',
      )
      assert.ok(existingQrApplyCode)
      const existingQrApplyLogin = await verifyCode({
        phoneNumber: qrApplyPhone,
        code: existingQrApplyCode,
        purpose: 'qrApply',
        fullName: 'Changed Name',
      })
      assert.equal(existingQrApplyLogin.status, 200)
      assert.equal(
        existingQrApplyLogin.body.user.id,
        qrApplyRegister.body.user.id,
      )
      assert.equal(existingQrApplyLogin.body.user.fullName, 'QR Apply User')

      const expiredPhone = '+972505555555'
      createdPhones.push(expiredPhone)
      await requestCode(expiredPhone, 'register')
      const expiredCode = getCapturedOtpCodeForTest(
        expiredPhone,
        'register',
      )
      assert.ok(expiredCode)
      await prisma.otpVerification.updateMany({
        where: {
          phoneNumber: expiredPhone,
          purpose: 'register',
          consumedAt: null,
        },
        data: {
          expiresAt: new Date(Date.now() - 60_000),
        },
      })
      const expiredResponse = await verifyCode({
        phoneNumber: expiredPhone,
        code: expiredCode,
        purpose: 'register',
        fullName: 'Expired User',
        track: 'restaurant',
      })
      assert.equal(expiredResponse.status, 400)
    } finally {
      await prisma.otpVerification.deleteMany({
        where: {
          phoneNumber: {
            in: createdPhones,
          },
        },
      })
      await prisma.user.deleteMany({
        where: {
          phoneNumber: {
            in: createdPhones,
          },
        },
      })
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }

          resolve()
        })
      })
      await prisma.$disconnect()
    }
  },
)
