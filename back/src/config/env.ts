import 'dotenv/config'

function getRequiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is not set`)
  }

  return value
}

function getPort() {
  const port = Number(process.env.PORT ?? 4000)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be a valid port number')
  }

  return port
}

const nodeEnv = process.env.NODE_ENV?.trim() || 'development'
const configuredFrontendUrl = process.env.FRONTEND_URL?.trim()

if (nodeEnv === 'production' && !configuredFrontendUrl) {
  throw new Error('FRONTEND_URL is not set')
}

export const env = {
  databaseUrl: getRequiredEnvironmentVariable('DATABASE_URL'),
  jwtSecret: getRequiredEnvironmentVariable('JWT_SECRET'),
  port: getPort(),
  frontendUrl:
    configuredFrontendUrl?.replace(/\/+$/, '') ||
    'http://localhost:5173',
  nodeEnv,
}
