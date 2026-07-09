# Security tests

The backend security test suite is skipped by default.

These tests create real users, restaurant owner profiles, restaurant jobs, public QR leads, and worker profiles. They also delete the records they create at the end of the run.

Because the tests write to the database, they must only run against a dedicated test database.

Never use the production `DATABASE_URL` as `TEST_DATABASE_URL`.

## What the tests check

The current suite checks the highest-risk restaurant launch paths:

- one owner cannot update/delete another owner's jobs
- one owner cannot update/delete another owner's QR leads
- non-admin users cannot access admin routes
- configured admin users can access admin routes
- public QR restaurant pages expose only public restaurant fields
- duplicate public QR lead submissions do not create duplicate leads
- worker Explore only returns active posted jobs, not drafts or inactive jobs
- phone OTP request/verify/register/login behavior
- OTP attempt limits, expiry, invalidation, and admin phone detection

## Create a test database

Use a separate database from your normal app database.

Example local Docker/Postgres URL:

```bash
postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public
```

The database name should make it obvious that it is a test database, for example:

```txt
peepss_security_test
jobtracker_test
restaurant_security_test
```

Do not use:

```txt
production database URLs
the normal local dev DATABASE_URL
the Render production DATABASE_URL
the Neon production DATABASE_URL
```

## Prepare the schema

Prisma migrations read `DATABASE_URL`, so temporarily point `DATABASE_URL` at the test database only for the migration command.

From `back/`:

```bash
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npx prisma migrate deploy
```

If you need Prisma Client regenerated:

```bash
npx prisma generate
```

## Run the tests

From `back/`, run either command:

```bash
RUN_SECURITY_TESTS=true TEST_DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npm test
```

or:

```bash
TEST_DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npm run test:security
```

The normal command is safe and skips the suite by default:

```bash
npm test
```

## Safety guards

The test setup refuses to run if:

- `RUN_SECURITY_TESTS=true` but `TEST_DATABASE_URL` is missing
- `TEST_DATABASE_URL` exactly equals `DATABASE_URL`
- `TEST_DATABASE_URL` looks production-like, including obvious `peepss`, `production`, or `prod` patterns
- `TEST_DATABASE_URL` points at a Neon host without a database name containing `test`

These guards are intentionally conservative. If a URL is blocked, create a clearer dedicated test database name instead of weakening the guard.

## Reset the test database

Only run reset commands against the dedicated test database.

This deletes data from the target database.

From `back/`:

```bash
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npx prisma migrate reset --force --skip-seed
```

Then rerun:

```bash
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npx prisma migrate deploy
```

## Production build note

Do not add these tests to the Render production build command.

Production should build with:

```bash
npm run build
```

Security tests should be run manually or in a dedicated CI/staging job with a dedicated test database.

## Phone OTP test notes

Phone OTP tests use the same gated command:

```bash
TEST_DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/peepss_security_test?schema=public" npm run test:security
```

The OTP tests do not read codes from API responses. In `NODE_ENV=test`, the backend OTP provider captures the generated code in memory for tests only.

In development, OTP codes are printed in backend logs:

```txt
OTP code for +972501234567: 1234
```

In production, OTP delivery returns a safe error until a real SMS/WhatsApp provider is added.
