# Backend Plan — AI Content Factory MVP

This document is the working backend plan for the next MVP stage. It does not
change the current Lovable UI, frontend routes, mock behavior, or deployment
setup.

## Technical Verdict

Use a small API service in front of Postgres. Postgres is the source of truth,
the API owns authentication and state transitions, and n8n is an external
executor called through webhooks. Telegram Mini App `initData` is validated by
the API on every authenticated request.

Client-side guards remain useful for UX, but they are not security boundaries.
Approve and publish rules must be enforced inside API transactions.

## Architecture

### API Service

The API service is the only layer allowed to mutate pipeline state. It should:

- validate Telegram Mini App `initData`;
- expose read/write endpoints for the Mini App;
- execute state transitions transactionally;
- enforce approve and publish guards;
- write `pipeline_logs` for state-changing actions;
- call n8n webhooks for asynchronous execution;
- receive n8n callbacks and apply validated updates.

The initial implementation can be a compact TypeScript service using Fastify or
Hono. The exact framework is less important than keeping transition rules
centralized and testable.

### Postgres as Source of Truth

Postgres stores all durable MVP state:

- sources;
- analyses;
- ideas;
- content packs and assets;
- review checks;
- publish jobs;
- metrics;
- pipeline logs;
- tools.

The frontend should eventually read from API endpoints backed by these tables,
not from local mock arrays. Postgres constraints should protect basic data
shape, while business guards that depend on multiple rows should run in API
transactions.

`updated_at` should be maintained by the database with a shared trigger so API
handlers do not need to remember to set it manually on every update.

### n8n Executor Role

n8n is an executor, not the source of truth. The API sends work to n8n through
webhooks, and n8n reports results back to API callback endpoints.

n8n should not bypass API guards or update Postgres directly for critical state
changes. Publish job status updates should come back through the API so they can
be logged, validated, and correlated with `publish_jobs`.

Analyses can originate from either a source or the metrics feedback loop. The
schema keeps `analyses.source_id` for source-origin analyses and `metric_id` for
metric-origin analyses, with a database check requiring exactly one of them.

### Telegram Mini App initData Auth

Every Mini App API request should include Telegram WebApp `initData`.

The API should:

- validate the Telegram signature server-side;
- reject expired or invalid `initData`;
- extract Telegram user id, username, and display name;
- derive `actor` for audit logs from validated Telegram data;
- never trust actor fields sent directly by the client.

## Server-Side Guards

### Approve Guard

Approve is impossible unless the pack has a required checklist and all required
checks are passed.

The API transaction for `approvePack` must:

1. lock the target pack;
2. load `review_checks` for that pack;
3. require at least one checklist row;
4. require at least one row with `required = true`;
5. require every required row to have `passed = true`;
6. write `approve_blocked` if the guard fails;
7. on success, set `content_packs.status = 'approved'`;
8. set `approved_by` from authenticated actor;
9. set `approved_at = now()`;
10. set pack assets to `approved`;
11. write an `approve` log.

### Publish Guard

Publish is impossible unless all of the following are true:

```ts
pack.status === "approved" && Boolean(pack.approved_by) && Boolean(pack.approved_at);
```

The API transaction for `publishPack` must:

1. lock the target pack;
2. verify `status = 'approved'`;
3. verify `approved_by is not null`;
4. verify `approved_at is not null`;
5. write `publish_blocked` if the guard fails;
6. create `publish_jobs`;
7. set pack status to `publishing`;
8. write a `schedule` log;
9. call n8n `publish content` webhook.

This guard is intentionally not implemented as a database trigger in the initial
schema draft. It is enforced in the API transaction because it needs actor,
logging, job creation, and n8n orchestration context.

## API Endpoint Draft

### Sources

- `GET /api/sources`
- `POST /api/sources`
- `PATCH /api/sources/:id`
- `POST /api/sources/:id/parse`
- `POST /api/sources/:id/reject`
- `POST /api/sources/:id/to-analysis`

### Analyses

- `GET /api/analyses`
- `PATCH /api/analyses/:id`
- `POST /api/analyses/:id/create-idea`
- `POST /api/analyses/:id/archive`
- `POST /api/analyses/:id/stop`

### Ideas

- `GET /api/ideas`
- `PATCH /api/ideas/:id`
- `POST /api/ideas/:id/accept`
- `POST /api/ideas/:id/reject`
- `POST /api/ideas/:id/build-pack`

### Content Packs and Review

- `GET /api/content-packs`
- `GET /api/content-packs/:id`
- `PATCH /api/content-packs/:id`
- `PATCH /api/content-assets/:id`
- `POST /api/content-assets/:id/rewrite`
- `POST /api/content-packs/:id/to-review`
- `POST /api/content-packs/:id/approve`
- `POST /api/content-packs/:id/reject`
- `POST /api/content-packs/:id/rewrite`
- `PATCH /api/review-checks/:id/toggle`

### Publishing

- `GET /api/publish-jobs`
- `POST /api/content-packs/:id/publish`
- `POST /api/publish-jobs/:id/retry`
- `POST /api/webhooks/n8n/publish-callback`

### Metrics and Logs

- `GET /api/metrics`
- `POST /api/metrics/:id/signal-to-analysis`
- `GET /api/logs`

## n8n Webhook Map

| Webhook              | API input                          | Expected callback               |
| -------------------- | ---------------------------------- | ------------------------------- |
| `parse source`       | `source_id`                        | parsed source fields and status |
| `generate analysis`  | `source_id`                        | analysis payload                |
| `generate idea`      | `analysis_id`                      | idea payload                    |
| `build content pack` | `idea_id`, platform targets        | assets and review checks        |
| `publish content`    | `pack_id`, publish job ids, assets | publish job status updates      |
| `collect metrics`    | `pack_id` or date range            | metrics payload                 |

## Implementation Order

1. Add the initial Postgres schema draft.
2. Implement the API service skeleton with health check and config loading.
3. Add Telegram Mini App `initData` validation middleware.
4. Implement read endpoints for all pipeline tables.
5. Implement source, analysis, idea, and pack write endpoints.
6. Implement approve guard inside an API transaction.
7. Implement publish guard and publish job creation inside an API transaction.
8. Add centralized `pipeline_logs` writes for every state-changing endpoint.
9. Add n8n webhook dispatch for parse, generation, publish, and metrics jobs.
10. Add n8n callback endpoints that update state only through the API layer.
11. Add backend tests for guards and state transitions.
12. Only after backend behavior matches the current MVP, switch the frontend
    data layer from mock state to API calls.

Before starting the API service, verify that the first migration can be applied
to a fresh Postgres database and that the service contract maps the current
frontend `Analysis.source_id` field correctly for both source-origin and
metric-origin analyses.
