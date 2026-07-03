import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'

export async function register(req: Request, res: Response) {
  try {
    const { email, password } = req.body as {
      email?: unknown
      password?: unknown
    }

    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({
        message: 'email and password are required',
      })
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({
        message: 'invalid email',
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'password must be at least 6 characters',
      })
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    })

    if (existingUser) {
      return res.status(409).json({
        message: 'user already exists',
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
    })

    return res.status(201).json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    })
  } catch (error) {
    console.error(error)

    return res.status(500).json({
      message: 'failed to register user',
    })
  }
}