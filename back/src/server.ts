import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import jobsRouter from './routes/jobs.routes.js'
import { authRouter } from './routes/auth.routes.js'
import profileRouter from './routes/profile.routes.js'


dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

app.use('/api/jobs', jobsRouter)
app.use('/api/auth', authRouter)
app.use('/api/profile', profileRouter)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
