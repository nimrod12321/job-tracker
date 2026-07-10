import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import cors, { type CorsOptions } from 'cors'
import { env } from './config/env.js'
import adminRouter from './routes/admin.routes.js'
import discoveryRouter from './routes/discovery.routes.js'
import jobsRouter from './routes/jobs.routes.js'
import ownerRouter from './routes/owner.routes.js'
import { authRouter } from './routes/auth.routes.js'
import healthRouter from './routes/health.routes.js'
import profileRouter from './routes/profile.routes.js'
import publicRestaurantRouter from './routes/publicRestaurant.routes.js'
import restaurantRouter from './routes/restaurant.routes.js'

export const app = express()

// Render puts exactly one reverse proxy (its own edge load balancer) in
// front of this app, which appends the real client IP as the last hop of
// X-Forwarded-For before forwarding the request. Trusting 1 hop tells
// Express to read that trusted, proxy-appended segment for req.ip, rather
// than blindly trusting whatever the client sent — which is what made the
// rate limiter spoofable before this was set. If this is ever deployed
// behind more than one proxy layer (e.g. a CDN in front of Render), this
// number must go up to match, or IP-based checks become bypassable again.
app.set('trust proxy', 1)

const allowedOrigins = new Set([env.frontendUrl])

if (env.nodeEnv !== 'production') {
  allowedOrigins.add('http://localhost:5173')
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = origin?.replace(/\/+$/, '')

    callback(
      null,
      !normalizedOrigin || allowedOrigins.has(normalizedOrigin),
    )
  },
}

app.use(cors(corsOptions))
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/health', healthRouter)
app.use('/api/admin', adminRouter)
app.use('/api/discover', discoveryRouter)
app.use('/api/jobs', jobsRouter)
app.use('/api/owner', ownerRouter)
app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)
app.use('/api/public', publicRestaurantRouter)
app.use('/api/restaurant', restaurantRouter)

const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error('Unhandled request error:', error)

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      message: 'invalid JSON body',
    })
    return
  }

  res.status(500).json({
    message: 'internal server error',
  })
}

app.use(errorHandler)

if (env.nodeEnv !== 'test') {
  app.listen(env.port, () => {
    console.log(`Environment: ${env.nodeEnv}`)
    console.log(`Database target: ${env.databaseTarget}`)
    console.log(`OTP provider selected: ${env.otpRuntimeProvider}`)
    console.log(`OTP channel selected: ${env.otpRuntimeChannel}`)
    console.log(`Server is running on port ${env.port}`)
  })
}
