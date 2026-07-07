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

const app = express()
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

app.listen(env.port, () => {
  console.log(`Server is running on port ${env.port}`)
})
