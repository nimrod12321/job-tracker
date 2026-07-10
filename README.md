# Peepss

Peepss is a full-stack AI job-search assistant for tracking applications, maintaining a career profile, discovering relevant jobs, and comparing a resume with specific roles.

Production domain: [peepss.com](https://peepss.com)

## Features

- JWT registration, login, session validation, and automatic logout
- User-specific job data
- Persistent job CRUD with PostgreSQL and Prisma
- Job status, priority, salary, source, links, notes, and descriptions
- Dashboard summary and recent jobs
- Editable resume/profile data
- Memory-only PDF resume text extraction
- AI job-description import with editable review before saving
- External job discovery with deterministic and optional AI ranking
- Saved AI job-match analysis with score, strengths, missing skills, suggestions, interview questions, and recruiter message

PDF uploads are limited to 5 MB. Uploaded files are processed in memory and are not stored. Image-only PDFs are not supported because the app does not perform OCR.

## Stack

- Frontend: React, TypeScript, Vite, React Router
- Backend: Node.js, Express, TypeScript, Zod
- Database: PostgreSQL, Prisma
- Authentication: JWT
- AI: OpenAI API
- Local database: Docker Compose

## Project Structure

```txt
job-tracker/
├── front/               React frontend
├── back/                Express backend
├── docker-compose.yml   Local PostgreSQL
└── README.md
```

## Environment Setup

Never commit real `.env` files or secrets.

For the full local/test/production separation guide, see [docs/environments.md](docs/environments.md).

### Backend

```bash
cd back
cp .env.example .env
```

Configure:

```env
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/jobtracker?schema=public"
JWT_SECRET="local-dev-secret"
PORT=4000
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
OTP_PROVIDER=console
OTP_CHANNEL=sms
OTP_MODE=development
OPENAI_API_KEY="replace_me_with_your_openai_api_key"
OPENAI_MODEL="replace_me_with_model_name"
```

The PostgreSQL port must match `docker-compose.yml`. This project currently publishes PostgreSQL on port `5433`.
`DATABASE_URL` and `JWT_SECRET` are required when the backend starts. `PORT` defaults to `4000`. In development, `FRONTEND_URL` defaults to `http://localhost:5173`; set it explicitly to the deployed frontend origin in production.

OpenAI credentials are read only when an AI feature is used, so the server can start without them. AI import and analysis return a readable error when configuration is missing, while external job search falls back to deterministic ranking.

### Frontend

```bash
cd front
cp .env.example .env
```

Configure:

```env
VITE_API_BASE_URL="http://localhost:4000/api"
```

For production, set this at frontend build time:

```env
VITE_API_BASE_URL="https://your-api-domain.com/api"
```

## Run Locally

### 1. Start PostgreSQL

From the project root:

```bash
docker compose up -d postgres
```

### 2. Install and prepare the backend

```bash
cd back
npm install
npx prisma migrate dev
npx prisma generate
npm run dev
```

The backend runs at `http://localhost:4000`.

### 3. Start the frontend

In another terminal:

```bash
cd front
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

## Main API Routes

All profile and job routes require `Authorization: Bearer <token>`.

```txt
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/health

GET    /api/profile
PUT    /api/profile
POST   /api/profile/resume-upload

GET    /api/jobs
POST   /api/jobs
POST   /api/jobs/fetch
POST   /api/jobs/import
GET    /api/jobs/:id
PUT    /api/jobs/:id
PATCH  /api/jobs/:id/status
POST   /api/jobs/:id/analyze
DELETE /api/jobs/:id
```

The import endpoint returns an editable draft and does not save a job. Resume upload returns extracted text and does not save the profile. Users confirm both through the normal frontend save flows.

`GET /api/health` is public and returns:

```json
{
  "status": "ok",
  "service": "peeps-api"
}
```

## Useful Commands

Backend:

```bash
cd back
npm run dev
npm run build
npx prisma migrate dev
npx prisma generate
npx prisma studio
```

Frontend:

```bash
cd front
npm run dev
npm run build
npm run lint
```

Database:

```bash
docker compose up -d postgres
docker compose down
```

To reset local database data:

```bash
docker compose down -v
docker compose up -d postgres
```

The reset command permanently deletes the local PostgreSQL volume.

## Production Deployment Checklist

This repository is deployment-ready but does not include platform-specific deployment configuration.

1. Provision PostgreSQL and set a production `DATABASE_URL`.
2. Set a strong, private `JWT_SECRET`.
3. Set `NODE_ENV=production` and `FRONTEND_URL` to the exact frontend origin. Production CORS does not allow arbitrary origins.
4. Set `OPENAI_API_KEY` and `OPENAI_MODEL` if AI features should be available.
5. Set the frontend build variable `VITE_API_BASE_URL` to the public backend URL ending in `/api`.
6. Apply existing migrations and build the backend:

```bash
cd back
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
npm start
```

7. Build the frontend:

```bash
cd front
npm ci
npm run build
```

8. Serve `front/dist` with the deployment platform and configure SPA route fallback to `index.html`.
9. Verify `GET https://your-api-domain.com/api/health`, authentication, jobs, profile, uploads, and configured AI features.

## Security Notes

- Never commit `.env` files, database credentials, JWT secrets, or OpenAI API keys.
- Use HTTPS for both deployed frontend and backend.
- Set `FRONTEND_URL` to the exact trusted frontend origin.
- Run `prisma migrate deploy`, not `prisma migrate dev`, against production databases.
- API errors return safe messages; detailed errors remain in backend logs.

## Current Limitations

- No automated test suite yet
- PDF extraction does not include OCR
- Job import requires pasted text and does not scrape websites
- AI features require valid OpenAI credentials and a compatible model
- Deployment remains platform-specific
