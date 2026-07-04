import { Router } from 'express'

const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  return res.json({
    status: 'ok',
    service: 'peeps-api',
  })
})

export default healthRouter
