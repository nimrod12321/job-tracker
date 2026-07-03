# AI Career Assistant / Job Tracker

A full-stack job tracking application built with React, TypeScript, Express, Prisma, PostgreSQL, and Docker.

The current version is a database-backed job tracker. The long-term goal is to evolve it into an AI Career Assistant that helps users track applications, analyze job descriptions, improve resumes, prepare for interviews, and manage the job search process more efficiently.

## Current Status

The app currently supports full CRUD for job applications using a real PostgreSQL database.

Users can:

* View jobs
* Add jobs
* Edit jobs
* Delete jobs
* Change job status
* Filter jobs by status
* See job counts
* Persist data after refresh and backend restart

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* CSS
* Fetch API

### Backend

* Node.js
* Express
* TypeScript
* Prisma ORM
* PostgreSQL

### Infrastructure

* Docker Compose
* Local PostgreSQL database running in Docker

## Project Structure

```txt id="ybbasi"
job-tracker/
├── front/        React + TypeScript + Vite frontend
├── back/         Node + Express + TypeScript backend
├── analytics/    future C analytics module
├── docs/         future documentation
├── docker-compose.yml
└── README.md
```

## Current Architecture

```txt id="cd9dlp"
React frontend
   ↓
jobsApi.ts service layer
   ↓
Express backend routes
   ↓
controller functions
   ↓
Prisma Client
   ↓
PostgreSQL database running in Docker
```

## Backend API

```txt id="fvy7bi"
GET     /health
GET     /api/jobs
POST    /api/jobs
PUT     /api/jobs/:id
PATCH   /api/jobs/:id/status
DELETE  /api/jobs/:id
```

## Job Model

Each job includes:

```txt id="8ywh19"
id
company
position
status
wantedSalary
location
notes
createdAt
updatedAt
```

Supported statuses:

```txt id="d35odq"
applied
HR
technical
rejected
offer
```

## Getting Started

### 1. Clone the project

```bash id="kho41y"
git clone <repo-url>
cd job-tracker
```

### 2. Start PostgreSQL with Docker

Make sure Docker Desktop is running.

From the project root:

```bash id="w3gfr9"
docker compose up -d postgres
```

Check that the database container is running:

```bash id="hetl6s"
docker ps
```

Expected container name:

```txt id="w18xm9"
job-tracker-postgres
```

### 3. Configure backend environment variables

Create a `.env` file inside `back/`:

```bash id="p542ft"
cd back
touch .env
```

Add:

```env id="xig9et"
DATABASE_URL="postgresql://jobtracker:jobtracker_password@127.0.0.1:5433/jobtracker?schema=public"
```

Note: If your Docker Compose maps PostgreSQL to port `5432`, use:

```env id="5horor"
DATABASE_URL="postgresql://jobtracker:jobtracker_password@localhost:5432/jobtracker?schema=public"
```

Use the port that appears in your `docker-compose.yml`.

### 4. Install backend dependencies

From `back/`:

```bash id="kc0jlp"
npm install
```

### 5. Run Prisma migrations

From `back/`:

```bash id="mej54p"
npx prisma migrate dev
```

Generate Prisma Client:

```bash id="l1733w"
npx prisma generate
```

Optional: open Prisma Studio:

```bash id="v1mwrn"
npx prisma studio
```

### 6. Run the backend

From `back/`:

```bash id="x0ypw5"
npm run dev
```

Backend runs on:

```txt id="jwsu90"
http://localhost:4000
```

Health check:

```txt id="nqxq13"
http://localhost:4000/health
```

Jobs API:

```txt id="hxwmq1"
http://localhost:4000/api/jobs
```

### 7. Run the frontend

Open a second terminal:

```bash id="jzyhsm"
cd front
npm install
npm run dev
```

Frontend runs on:

```txt id="af7bmp"
http://localhost:5173
```

## Development Commands

### Backend

```bash id="l9yxei"
cd back
npm run dev
npm run build
npx prisma migrate dev
npx prisma generate
npx prisma studio
```

### Frontend

```bash id="am3gyv"
cd front
npm run dev
npm run build
```

### Database

Start database:

```bash id="v6kbjt"
docker compose up -d postgres
```

Stop database:

```bash id="cfv7pa"
docker compose down
```

Reset local database volume:

```bash id="9trjr4"
docker compose down -v
docker compose up -d postgres
```

Warning: resetting the volume deletes local database data.

## Completed Milestones

* Frontend CRUD
* Backend Express API
* Frontend connected to backend
* Removed localStorage flow
* Added PostgreSQL
* Added Prisma schema and migration
* Replaced in-memory backend data with PostgreSQL
* Full persistent CRUD
* Refactored backend job response mapping

## Current Limitations

* No authentication yet
* All jobs are global, not user-specific
* Validation is still basic
* No automated tests yet
* No AI features yet
* No deployment yet

## Roadmap

### Phase 1 — Backend Quality

* Improve request validation with Zod
* Add cleaner error handling
* Add seed script
* Add backend API tests

### Phase 2 — Authentication

* Add user model
* Register
* Login
* Password hashing
* JWT authentication
* Protect job routes
* Make jobs user-specific

### Phase 3 — Product Features

* Add job description field
* Add job URL
* Add company URL
* Add source field
* Add date applied
* Add priority
* Add salary range

### Phase 4 — AI Career Assistant

* Analyze job descriptions
* Generate match score
* Identify missing skills
* Suggest resume improvements
* Generate interview questions
* Generate HR/recruiter messages

### Phase 5 — Deployment

* Deploy frontend
* Deploy backend
* Use managed PostgreSQL
* Configure production environment variables

### Phase 6 — GitHub Polish

* Add screenshots
* Add architecture diagram
* Add demo video or GIF
* Improve API documentation
* Add project explanation for interviews
