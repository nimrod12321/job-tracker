# AI Career Assistant / Job Tracker

A full-stack application for tracking job applications, maintaining a career profile, and using AI to compare a resume with specific roles.

## Features

- JWT registration, login, session validation, and automatic logout
- User-specific job data
- Persistent job CRUD with PostgreSQL and Prisma
- Job status, priority, salary, source, links, notes, and descriptions
- Dashboard summary and recent jobs
- Editable resume/profile data
- Memory-only PDF resume text extraction
- AI job-description import with editable review before saving
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

### Backend

```bash
cd back
cp .env.example .env
```

Configure:

```env
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/jobtracker?schema=public"
JWT_SECRET="replace_me_with_a_real_secret"
OPENAI_API_KEY="replace_me_with_your_openai_api_key"
OPENAI_MODEL="replace_me_with_model_name"
PORT=4000
```

The PostgreSQL port must match `docker-compose.yml`. This project currently publishes PostgreSQL on port `5433`.

### Frontend

```bash
cd front
cp .env.example .env
```

Configure:

```env
VITE_API_BASE_URL="http://localhost:4000/api"
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

GET    /api/profile
PUT    /api/profile
POST   /api/profile/resume-upload

GET    /api/jobs
POST   /api/jobs
POST   /api/jobs/import
GET    /api/jobs/:id
PUT    /api/jobs/:id
PATCH  /api/jobs/:id/status
POST   /api/jobs/:id/analyze
DELETE /api/jobs/:id
```

The import endpoint returns an editable draft and does not save a job. Resume upload returns extracted text and does not save the profile. Users confirm both through the normal frontend save flows.

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

## Current Limitations

- No automated test suite yet
- PDF extraction does not include OCR
- Job import requires pasted text and does not scrape websites
- AI features require valid OpenAI credentials and a compatible model
- No production deployment configuration yet
