# Peepss environments

Peepss should always keep local development, tests, and production separated.

Production has real users and real OTP delivery. Do not use production data for local testing.

## Never commit

Never commit:

- `back/.env`
- real `DATABASE_URL` values
- real `JWT_SECRET`
- Twilio credentials
- Neon credentials
- production admin phone numbers if they are private

Commit only safe examples such as `back/.env.example`.

## Local development

Local development should use Docker PostgreSQL and the console OTP provider.

Recommended `back/.env` shape:

```env
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/jobtracker?schema=public"
JWT_SECRET="local-dev-secret"
PORT=4000
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"

OTP_PROVIDER=console
OTP_CHANNEL=sms
OTP_MODE=development

ADMIN_PHONES="+972501234567"
ADMIN_EMAILS=""

# Optional while the Map feature is disabled. Use separate restricted keys.
GOOGLE_MAPS_API_KEY="server-only-places-key"
```

Recommended `front/.env` additions:

```env
VITE_GOOGLE_MAPS_API_KEY="browser-restricted-maps-key"
VITE_ENABLE_JOB_MAP="true"
VITE_ENABLE_JOB_BOARD="false"
```

For local Job Board and Map testing, add an ignored `front/.env.local`:

```env
VITE_ENABLE_JOB_BOARD="true"
VITE_ENABLE_JOB_MAP="true"
```

The full owner Job Board requires both Vite development mode and
`VITE_ENABLE_JOB_BOARD=true`. A production build always keeps the muted
coming-soon Job Board, even if the variable is accidentally set to `true`.
The Map flag is independent from the Job Board flag.

The browser key is intentionally separate from the backend key. Restrict the
browser key to localhost and the Peepss/Vercel domains, and restrict it to the
Maps JavaScript/Places browser APIs. Restrict `GOOGLE_MAPS_API_KEY` to the
backend Place Details API. Never put the backend key in a `VITE_` variable.

In this mode, OTP codes are printed in the backend terminal. No real SMS or WhatsApp cost is used.

Start local PostgreSQL:

```bash
docker compose up -d postgres
```

Run local migrations:

```bash
cd back
npx prisma migrate dev
```

Start the backend:

```bash
cd back
npm run dev
```

## Local test database

Security and OTP integration tests must use `TEST_DATABASE_URL`, not `DATABASE_URL`.

Recommended test database URL:

```env
TEST_DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public"
```

Create the test database if needed:

```bash
docker exec job-tracker-postgres createdb -U jobtracker peepss_security_test
```

Apply migrations to the test database:

```bash
cd back
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npx prisma migrate deploy
```

Run gated security tests:

```bash
cd back
TEST_DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npm run test:security
```

Test behavior:

- tests use `TEST_DATABASE_URL`
- tests use fake/captured OTP
- tests never use Twilio
- tests refuse to run if `TEST_DATABASE_URL` equals `DATABASE_URL`

## Reset local databases safely

Only reset local or test databases. Never run reset against Neon production.

Reset local dev database:

```bash
cd back
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/jobtracker?schema=public" npx prisma migrate reset
```

Reset local test database:

```bash
cd back
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npx prisma migrate reset --force --skip-seed
```

## Production on Render

Production should use Render environment variables, Neon production PostgreSQL, and Twilio SMS OTP.

Render backend env checklist:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="strong-production-secret"
FRONTEND_URL="https://peepss.com"
NODE_ENV="production"

OTP_PROVIDER=twilio
OTP_CHANNEL=sms
OTP_MODE=production

TWILIO_ACCOUNT_SID="AC..."
TWILIO_API_KEY_SID="SK..."
TWILIO_API_KEY_SECRET="..."
TWILIO_MESSAGING_SERVICE_SID="MG..."

ADMIN_PHONES="+972..."
ADMIN_EMAILS=""

GOOGLE_MAPS_API_KEY="server-only-production-places-key"
```

Set `VITE_GOOGLE_MAPS_API_KEY` and `VITE_ENABLE_JOB_MAP=true` in the frontend
deployment only when the worker Map should be visible. With the flag missing or
false, Swipe remains available and the Map tab is hidden.

Leave `VITE_ENABLE_JOB_BOARD` unset or set it to `false` in production. The
development-mode guard also prevents the functional Job Board from appearing
in production if this variable is mistakenly set to `true`.

Production must not use:

- local PostgreSQL
- `OTP_PROVIDER=console`
- `TEST_DATABASE_URL`
- sandbox-only Twilio values unless deliberately testing a non-production service

Run production migrations only against the production database from a controlled environment:

```bash
cd back
npx prisma migrate deploy
```

Do not run `prisma migrate reset` in production.

## OTP behavior by environment

| Environment | Database | OTP provider | Cost |
| --- | --- | --- | --- |
| Local dev | Docker PostgreSQL | console logs | free |
| Tests | `TEST_DATABASE_URL` | fake/captured | free |
| Production | Neon production | Twilio SMS | real SMS cost |

## Safe startup logs

The backend logs safe environment information at startup:

```txt
Environment: development/test/production
Database target: local/prod/unknown
OTP provider selected: console/twilio/fake
OTP channel selected: sms/whatsapp/none
```

These logs do not print database URLs, JWT secrets, Twilio secrets, or OTP codes.

## Production safety guards

The backend fails fast if:

- `NODE_ENV=production` and `DATABASE_URL` points to localhost
- `NODE_ENV=production` and `OTP_PROVIDER=console`
- `OTP_PROVIDER=twilio` is missing required Twilio env values
- `OTP_PROVIDER=twilio` uses an unsupported `OTP_CHANNEL`

In `NODE_ENV=test`, OTP always uses the fake/captured provider even if `OTP_PROVIDER=twilio` is accidentally present.
