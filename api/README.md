# AI Content Factory API

Minimal backend API for the closed-demo MVP flow. The frontend can call these
endpoints through `VITE_API_URL`.

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
- `POST /api/sources/import/google-sheet`
- `POST /api/sources/import/csv`
- `GET /api/analyses`
- `POST /api/sources/:id/to-analysis`
- `POST /api/sources/to-analysis-bulk`
- `GET /api/ideas`
- `POST /api/analyses/:id/create-idea`
- `POST /api/analysis/:id/to-idea`
- `GET /api/content-packs`
- `POST /api/ideas/:id/build-pack`
- `GET /api/content-assets`
- `GET /api/review-checks`
- `POST /api/content-packs/:id/send-to-review`
- `POST /api/content-packs/:id/approve`
- `POST /api/content-packs/:id/reject`
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

## ViralMaxing Refs Import

Import ViralMaxing rows into `sources` first. Each CSV row becomes one
`source_type = viralmaxing` source with `status = imported`; metrics such as
`views`, `likes`, `comments`, `shares`, `saves`, `engagement_rate`, `platform`,
`author`, `caption`, `published_at`, `detected_at`, and `niche` are stored in
`raw_payload`.

```bash
curl -sS -X POST http://127.0.0.1:4000/api/sources/import/google-sheet \
  -H 'content-type: application/json' \
  -d '{"url":"https://docs.google.com/spreadsheets/d/<sheet-id>/edit?gid=0"}'

curl -sS -X POST http://127.0.0.1:4000/api/sources/import/csv \
  -H 'content-type: application/json' \
  -d '{
    "csv": "url,platform,views,likes,comments,shares,saves,engagement_rate,author,caption\nhttps://example.com,TikTok,1000,80,12,9,5,10.6,@account,Winning hook"
  }'

curl -sS http://127.0.0.1:4000/api/sources
curl -sS http://127.0.0.1:4000/api/logs
```

## Source To Analysis Flow

```bash
SOURCE_ID="<created-source-id>"

curl -sS -X POST "http://127.0.0.1:4000/api/sources/${SOURCE_ID}/to-analysis"

curl -sS -X POST http://127.0.0.1:4000/api/sources/to-analysis-bulk \
  -H 'content-type: application/json' \
  -d '{"source_ids":["'"${SOURCE_ID}"'"]}'

curl -sS http://127.0.0.1:4000/api/analyses
curl -sS http://127.0.0.1:4000/api/logs
```

Analysis uses `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` when
all four values are set. Without AI env, the API uses a deterministic
ViralMaxing fallback that still considers `views`, `likes`, `comments`,
`shares`, `saves`, `engagement_rate`, `platform`, `author`, `caption`,
`published_at`, and `niche`. The fallback writes `ai_fallback_used` to
`pipeline_logs`; AI failures write `ai_error` and then fallback.

## Analysis To Idea Flow

```bash
ANALYSIS_ID="<created-analysis-id>"

curl -sS -X POST "http://127.0.0.1:4000/api/analyses/${ANALYSIS_ID}/create-idea"
curl -sS -X POST "http://127.0.0.1:4000/api/analysis/${ANALYSIS_ID}/to-idea"

curl -sS http://127.0.0.1:4000/api/ideas
curl -sS http://127.0.0.1:4000/api/logs
```

## Idea To Content Pack Flow

```bash
IDEA_ID="<created-idea-id>"

curl -sS -X POST "http://127.0.0.1:4000/api/ideas/${IDEA_ID}/build-pack"

curl -sS http://127.0.0.1:4000/api/content-packs
curl -sS http://127.0.0.1:4000/api/content-assets
curl -sS http://127.0.0.1:4000/api/logs
```

## Content Pack Review Flow

```bash
PACK_ID="<created-pack-id>"

curl -sS -X POST "http://127.0.0.1:4000/api/content-packs/${PACK_ID}/send-to-review"
curl -sS http://127.0.0.1:4000/api/review-checks

curl -sS -X POST "http://127.0.0.1:4000/api/content-packs/${PACK_ID}/approve"

curl -sS -X POST "http://127.0.0.1:4000/api/content-packs/${PACK_ID}/reject" \
  -H 'content-type: application/json' \
  -d '{"reason":"Needs rewrite before publishing."}'

curl -sS http://127.0.0.1:4000/api/content-packs
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
