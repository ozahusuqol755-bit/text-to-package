# MVP_FLOW — Внутренний пульт оператора AI Content Factory (К/З)

Внутренний оператор-дашборд в стиле Telegram Mini App. Управляет конвейером
производства контента: **источник → анализ → идея → пакет → проверка → публикация → метрики**.

Документ нужен, чтобы Codex (или другой разработчик) мог быстро понять
архитектуру, статусы, действия и точки подключения backend.

---

## 1. Этапы процесса

| #  | Этап              | Маршрут       | Сущность(и)                     | Главное действие                |
| -- | ----------------- | ------------- | ------------------------------- | ------------------------------- |
| 1  | Источники         | `/sources`    | `Source`                        | parse / reject / to_analysis    |
| 2  | Анализ            | `/analysis`   | `Analysis`                      | create_idea / archive / stop    |
| 3  | Идеи              | `/ideas`      | `Idea`                          | accept / reject / build_pack    |
| 4  | Контент-пакеты    | `/packs`      | `ContentPack`, `ContentAsset`   | edit / rewrite_asset / to_review|
| 5  | Проверка          | `/review`     | `ReviewCheck`, `ContentPack`    | toggle_check / approve / reject |
| 6  | Публикация        | `/publish`    | `PublishJob`                    | publish / retry                 |
| 7  | Метрики           | `/metrics`    | `Metric`                        | signal_to_analysis              |
| –  | Логи              | `/logs`       | `LogEvent`                      | audit trail всех действий       |
| –  | Тулзы             | `/tools`      | `Tool`                          | карта инструментов              |

---

## 2. Сущности

Все типы — в `src/types/pipeline.ts`. Кратко:

- **Source** — реф / тренд / бренд-док / research. Поля: `raw_text`, `summary`, `hooks`, `cta`, `format`, `source_risk`, `tags`.
- **Analysis** — паттерн: `meaning`, `hook`, `angle`, `pain`, `promise`, `cta`, `risk_notes`, `risk_status`, `platform_fit`, `priority_score`, `decision`, `source_refs`.
- **Idea** — `topic`, `angle`, `source_refs`, `platform_targets`, `priority`, `priority_score`, `tags`.
- **ContentPack** — обёртка над ассетами одной идеи. Содержит approve-поля: `approved_by`, `approved_at`.
- **ContentAsset** — материал под одну площадку. Поля: `platform`, `format`, `text` / `image_prompt` / `video_prompt`, `version`, `qc_score`, `source_refs`.
- **ReviewCheck** — пункт чек-листа: `label`, `required`, `passed`.
- **PublishJob** — задача публикации: `pack_id`, `asset_id`, `platform`, `tool`, `status`, `attempts`, `error`.
- **Metric** — статистика поста: views, likes, comments, shares, saves, ctr, er, errors, conclusion, `signaled`.
- **Tool** — справочник инструментов (Claude Code, n8n, DOHOO, Postgres, …).
- **LogEvent** — audit trail: `ts`, `stage`, `action`, `actor`, `entity_id`, `level`, `message`.

---

## 3. Статусы

### Source
`new → parsed → ready_for_analysis` · ветка `rejected` · ошибка `failed`.

### Analysis (decision + risk_status)
- `decision`: `to_idea | archive | stop`
- `risk_status`: `active | archived | stopped`

### Idea
`draft → accepted → in_pack` · ветка `rejected`.

### ContentPack
`draft → ready_for_review → approved → publishing → published`
ветки: `rewrite_requested`, `rejected`.

### ContentAsset
`draft → ready_for_review → approved` · ветка `rewrite_requested` / `rejected`.

### PublishJob
`scheduled → publishing → published` · ветка `failed` (→ retry → publishing).

---

## 4. Действия (бизнес-слой)

Все переходы реализованы как чистые функции в `src/lib/pipeline/transitions.ts`
и вызываются из `src/store/PipelineStore.tsx` (React context + `useReducer`).

| Функция (стор)                          | Pure helper (transitions)        | Что делает                                                   |
| --------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| `parseSource(id)`                       | `parseSource(src)`               | Заполняет mock-поля парсинга, статус → `parsed`              |
| `sendSourceToAnalysis(id)`              | `buildAnalysisFromSource(src)`   | Статус источника → `ready_for_analysis`, создаёт `Analysis`  |
| `createIdeaFromAnalysis(id)`            | `buildIdeaFromAnalysis(an)`      | Создаёт `Idea` с `source_refs` из анализа                    |
| `archiveAnalysis(id)` / `stopAnalysis`  | —                                | Меняет `decision` + `risk_status`                            |
| `createContentPackFromIdea(id)`         | `buildPackFromIdea(idea)`        | Создаёт `ContentPack` + 9 `ContentAsset` + базовые `ReviewCheck` |
| `requestAssetRewrite(assetId)`          | `bumpAssetVersion(asset)`        | Бампит `version`, статус → `rewrite_requested`               |
| `sendPackToReview(packId)`              | —                                | Статус пакета и ассетов → `ready_for_review`                 |
| `toggleCheck(checkId)`                  | —                                | Переключает `passed` у чек-листа                             |
| `approvePack(packId, approver?)`        | `canApprovePack(checks, packId)` | Только если все `required` чек-боксы ✓. Пишет `approved_by`, `approved_at` |
| `requestPackRewrite(packId)` / `rejectPack` | —                            | Статус пакета → `rewrite_requested` / `rejected`             |
| `publishPack(packId)`                   | `buildPublishJobs`, `canPublishPack` | Создаёт `PublishJob` под каждый ассет, симулирует n8n/DOHOO |
| `retryPublishJob(jobId)`                | —                                | Повтор failed-job: `attempts++`, статус → `publishing`       |
| `createAnalysisSignalFromMetrics(id)`   | `buildAnalysisFromMetric(m)`     | Превращает метрику в новый `Analysis` (feedback loop)        |

Для обратной совместимости в сторе оставлены alias-имена
(`buildPackFromIdea`, `submitPackForReview`, `requestRewrite`,
`requestRewriteAsset`, `signalMetricToAnalysis`).

---

## 5. Approve gate (hard rule)

Публикация **запрещена**, пока одновременно не выполнено:

```ts
pack.status === "approved"
&& Boolean(pack.approved_by)
&& Boolean(pack.approved_at)
```

Это правило реализовано в одном месте — `canPublishPack()` в
`src/lib/pipeline/transitions.ts` — и используется в:

- кнопке Publish (`/publish`) — `disabled`, если правило не выполнено;
- `publishPack()` в сторе — повторно проверяет перед созданием `PublishJob`,
  иначе пишет `publish_blocked` в логи.

Approve, в свою очередь, защищён `canApprovePack()`: все `required`
чек-боксы должны быть `passed`. Иначе approve пишет `approve_blocked` и
не меняет статус.

Когда будет backend, тот же набор условий должен проверяться **на сервере**
(Postgres-CHECK / триггер / API-валидатор) — клиент не должен быть
единственным гейтом.

---

## 6. Логирование

Каждое действие пишет `LogEvent`:

```
{ ts, stage, action, actor, entity_id, level, message }
```

Видны на странице `/logs`. Сохраняются in-memory (последние 300).

При подключении backend — логи уезжают в `pipeline_logs` таблицу Postgres
и/или Telegram-канал оператора.

---

## 7. Что сейчас mock

| Слой                | Сейчас                                | Куда подключаем |
| ------------------- | ------------------------------------- | --------------- |
| Хранилище           | React context + `useReducer` in-memory | Postgres        |
| Парсинг источников  | `parseSource()` генерит mock-поля     | n8n + ScrapeCreators + NotebookLM |
| Анализ              | Авто-`Analysis` из источника          | Claude Code worker |
| QC ассетов          | Псевдо-случайный `qc_score`           | Codex review job |
| Publish             | `window.setTimeout` + случайный fail  | n8n → DOHOO / Telegram Bot API |
| Метрики             | Сгенерированы из jobs                 | DOHOO / platform APIs → cron import |
| Telegram-оператор   | Hardcoded `@operator_kz` / `@editor_kz` | Telegram WebApp `initData` |
| Логи                | In-memory массив                      | `pipeline_logs` (Postgres) + Telegram-канал |

---

## 8. Структура папок (текущая)

```
src/
  types/pipeline.ts                  ← все entities в одном файле
  data/
    sources.ts
    analyses.ts
    ideas.ts
    packs.ts                         ← packs + assets + checks
    metrics.ts                       ← metrics + publishJobs
    tools.ts
    logs.ts
    mockData.ts                      ← re-export всех модулей
  lib/pipeline/transitions.ts        ← pure business transitions
  store/PipelineStore.tsx            ← React context + reducer + dispatch glue
  components/
    layout/{PipelineHeader,BottomNav}.tsx
    stage/{StageHeader,StatusBadge}.tsx
  routes/
    index.tsx                        ← обзор
    sources.tsx
    analysis.tsx
    ideas.tsx
    packs.tsx
    review.tsx
    publish.tsx
    metrics.tsx
    tools.tsx
    logs.tsx
docs/MVP_FLOW.md                     ← этот файл
```

---

## 9. Точки подключения backend (для Codex)

1. **Заменить `mockData.ts` → реальные fetch-вызовы.** Каждая сущность уже
   изолирована в своём файле в `src/data/`.
2. **Серверная валидация approve gate** (см. §5) — обязательная зеркальная
   проверка `canApprovePack` + `canPublishPack`.
3. **`publishPack()` → реальный вызов n8n webhook** (вместо `setTimeout`).
   n8n должен callback'ом обновлять `PublishJob.status` через webhook
   `/api/public/publish-callback`.
4. **`parseSource()` → n8n + ScrapeCreators / NotebookLM**. Сейчас функция
   возвращает `Partial<Source>` — её легко заменить на ответ парсера.
5. **Логи** — слой `log()` уже централизован, можно дополнительно слать
   `INSERT INTO pipeline_logs ...`.

---

## 10. Что НЕ делаем в этом MVP

- ❌ auth / login / Telegram bot token
- ❌ billing / Stripe / subscriptions
- ❌ teams / роли / multi-tenant
- ❌ public landing / маркетинг
- ❌ реальный Supabase / Postgres / API-ключи
- ❌ production integrations

Цель MVP — рабочий **операторский UX** с прозрачной моделью данных,
готовый под подключение backend в следующей итерации.
