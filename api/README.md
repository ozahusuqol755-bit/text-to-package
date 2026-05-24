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

If Postgres is not running, DB-backed endpoints return
`503 database_unavailable`. If the database exists but the migration has not
been applied, they return `database_schema_missing`.

## Current Endpoints

- `GET /health`
- `GET /api/sources`
- `POST /api/sources`
- `GET /api/analyses`
- `POST /api/sources/:id/to-analysis`
- `GET /api/content-packs`
- `GET /api/logs`

## Source Write Flow

```bash
curl -sS -X POST http://127.0.0.1:4000/api/sources \
  -H 'content-type: application/json' \
  -d '{
    "title": "Demo source",
    "source_type": "url",
    "url": "https://example.com",
    "tags": ["demo"]
  }'

curl -sS http://127.0.0.1:4000/api/sources
curl -sS http://127.0.0.1:4000/api/logs
```

## Source To Analysis Flow

```bash
SOURCE_ID="<created-source-id>"

curl -sS -X POST "http://127.0.0.1:4000/api/sources/${SOURCE_ID}/to-analysis"

curl -sS http://127.0.0.1:4000/api/analyses
curl -sS http://127.0.0.1:4000/api/logs
```

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
