# AI Content Factory API

Minimal backend API skeleton for the next MVP stage. The frontend is not wired
to this API yet.

## Stack

- TypeScript
- Fastify
- pg
- dotenv
- zod
- tsx for local development

## Setup

```bash
cd api
npm install
cp .env.example .env
npm run dev
```

The API expects `DATABASE_URL` to point at a Postgres database with
`db/migrations/001_initial_schema.sql` applied manually. Migrations are not run
automatically.

## Current Endpoints

- `GET /health`
- `GET /api/sources`
- `GET /api/content-packs`
- `GET /api/logs`

## Authentication

`src/middleware/telegramAuth.ts` currently reads Telegram Mini App init data
from the `x-telegram-init-data` header, but signature validation is still a
TODO.

The current actor is a mock/dev fallback and is unsafe for production.

## Guards

`src/lib/guards.ts` contains placeholders for the server-side rules:

- approve requires a required checklist and all required checks passed;
- publish requires `status = approved`, `approved_by`, and `approved_at`.

These rules must be enforced inside API transactions before write endpoints are
implemented.
