import { Router } from 'express'
import { getMe, register, login } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'


export const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.get('/me', requireAuth, getMe)