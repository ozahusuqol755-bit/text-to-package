# MVP_FLOW — технический паспорт MVP AI Content Factory

Внутренний операторский дашборд в стиле Telegram Mini App для управления
конвейером производства контента:

**Источники → Анализ → Идеи → Контент-пакеты → Проверка → Публикация → Метрики**.

Документ фиксирует текущую модель MVP: сущности, статусы, маршруты, бизнес-действия,
audit trail и правила approve/publish gate. Он не описывает новую архитектуру и не
предполагает подключение серверных интеграций в рамках текущего MVP.

---

## 1. Этапы и маршруты

| #   | Этап           | Маршрут     | Основные сущности             | Основные действия                              |
| --- | -------------- | ----------- | ----------------------------- | ---------------------------------------------- |
| 1   | Источники      | `/sources`  | `Source`                      | `parse`, `reject`, `to_analysis`               |
| 2   | Анализ         | `/analysis` | `Analysis`                    | `create_idea`, `archive`, `stop`               |
| 3   | Идеи           | `/ideas`    | `Idea`                        | `accept`, `reject`, `build_pack`               |
| 4   | Контент-пакеты | `/packs`    | `ContentPack`, `ContentAsset` | `edit_asset`, `rewrite_asset`, `to_review`     |
| 5   | Проверка       | `/review`   | `ReviewCheck`, `ContentPack`  | `toggle_check`, `approve`, `reject`, `rewrite` |
| 6   | Публикация     | `/publish`  | `PublishJob`, `ContentPack`   | `schedule`, `publish`, `fail`, `retry`         |
| 7   | Метрики        | `/metrics`  | `Metric`                      | `signal_to_analysis`                           |
| —   | Логи           | `/logs`     | `LogEvent`                    | просмотр audit trail                           |
| —   | Инструменты    | `/tools`    | `Tool`                        | справочник инструментов                        |

---

## 2. Сущности

Все типы находятся в `src/types/pipeline.ts`.

- **Source** — входной материал: конкурентный референс, тренд, бренд-документ,
  заметка, видео, скриншот, метрика или research. Важные поля: `raw_text`,
  `summary`, `hooks`, `cta`, `format`, `source_risk`, `tags`.
- **Analysis** — результат разбора источника: `meaning`, `hook`, `angle`, `pain`,
  `promise`, `cta`, `risk_notes`, `risk_status`, `platform_fit`,
  `priority_score`, `decision`, `source_refs`.
- **Idea** — тема для будущего пакета: `topic`, `angle`, `source_refs`,
  `platform_targets`, `priority`, `priority_score`, `tags`, `status`.
- **ContentPack** — пакет материалов по одной идее. Хранит статус пакета и поля
  ручного одобрения: `approved_by`, `approved_at`.
- **ContentAsset** — единица контента для конкретной площадки. Важные поля:
  `platform`, `format`, `text` / `image_prompt` / `video_prompt`, `source_refs`,
  `status`, `version`, `qc_score`.
- **ReviewCheck** — пункт чек-листа проверки: `label`, `required`, `passed`,
  опционально `note`.
- **PublishJob** — задача публикации ассета: `pack_id`, `asset_id`, `platform`,
  `tool`, `status`, `scheduled_at`, `published_at`, `error`, `attempts`.
- **Metric** — результат публикации: `views`, `likes`, `comments`, `shares`,
  `saves`, `ctr`, `er`, `errors`, `conclusion`, `signaled`.
- **Tool** — справочник инструментов, которые отображаются в интерфейсе.
- **LogEvent** — запись audit trail. Описан подробно в разделе 6.

---

## 3. Статусы

### Source

`new → parsed → ready_for_analysis`

Дополнительные ветки: `rejected`, `failed`.

### Analysis

`Analysis` использует два поля:

- `decision`: `to_idea | archive | stop`
- `risk_status`: `active | stopped | archived`

### Idea

`draft → accepted → in_pack`

Дополнительная ветка: `rejected`.

### ContentPack

`draft → ready_for_review → approved → publishing → published`

Дополнительные ветки: `rewrite_requested`, `rejected`, `scheduled`.

### ContentAsset

`draft → ready_for_review → approved`

Дополнительные ветки: `rewrite_requested`, `rejected`.

### PublishJob

`publishing → published`

Дополнительные статусы: `approved`, `scheduled`, `failed`.
В текущем mock-потоке `buildPublishJobs()` сразу создаёт jobs со статусом
`publishing`.

---

## 4. Бизнес-действия

Чистые переходы находятся в `src/lib/pipeline/transitions.ts`.
React Context + reducer в `src/store/PipelineStore.tsx` применяют эти переходы
к in-memory состоянию и пишут логи.

| Метод стора                                 | Pure helper                                              | Поведение                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `addSource(input)`                          | —                                                        | Создаёт `Source` со статусом `new`.                                                                                                    |
| `parseSource(id)`                           | `parseSource(src)`                                       | Заполняет mock-поля парсинга, переводит источник в `parsed`.                                                                           |
| `rejectSource(id)`                          | —                                                        | Переводит источник в `rejected`.                                                                                                       |
| `sendSourceToAnalysis(id)`                  | `buildAnalysisFromSource(src)`                           | Переводит источник в `ready_for_analysis`, создаёт `Analysis`.                                                                         |
| `createIdeaFromAnalysis(id)`                | `buildIdeaFromAnalysis(analysis)`                        | Создаёт `Idea` на основе анализа.                                                                                                      |
| `archiveAnalysis(id)`                       | —                                                        | Ставит `decision: "archive"` и `risk_status: "archived"`.                                                                              |
| `stopAnalysis(id)`                          | —                                                        | Ставит `decision: "stop"` и `risk_status: "stopped"`.                                                                                  |
| `acceptIdea(id)`                            | —                                                        | Переводит идею в `accepted`.                                                                                                           |
| `rejectIdea(id)`                            | —                                                        | Переводит идею в `rejected`.                                                                                                           |
| `createContentPackFromIdea(id)`             | `buildPackFromIdea(idea)`                                | Создаёт `ContentPack`, `ContentAsset[]` и `ReviewCheck[]`; количество ассетов зависит от `platform_targets`, fallback — все платформы. |
| `requestAssetRewrite(assetId)`              | `bumpAssetVersion(asset)`                                | Увеличивает `version`, переводит ассет в `rewrite_requested`.                                                                          |
| `updateAssetText(assetId, text)`            | —                                                        | Обновляет текст, image prompt или video prompt ассета.                                                                                 |
| `sendPackToReview(packId)`                  | —                                                        | Переводит пакет и его ассеты в `ready_for_review`.                                                                                     |
| `requestPackRewrite(packId)`                | —                                                        | Переводит пакет в `rewrite_requested`.                                                                                                 |
| `rejectPack(packId)`                        | —                                                        | Переводит пакет в `rejected`.                                                                                                          |
| `toggleCheck(checkId)`                      | —                                                        | Переключает `passed` у пункта чек-листа.                                                                                               |
| `approvePack(packId, approver?)`            | `canApprovePack(checks, packId)`                         | Одобряет пакет только при выполнении approve gate.                                                                                     |
| `publishPack(packId)`                       | `canPublishPack(pack)`, `buildPublishJobs(pack, assets)` | Создаёт publish jobs и запускает mock-публикацию только при выполнении publish gate.                                                   |
| `retryPublishJob(jobId)`                    | —                                                        | Повторяет failed job: увеличивает `attempts`, переводит job в `publishing`, затем mock-поток переводит её в `published`.               |
| `createAnalysisSignalFromMetrics(metricId)` | `buildAnalysisFromMetric(metric)`                        | Создаёт новый `Analysis` из метрики и помечает метрику как `signaled`.                                                                 |

В сторе также оставлены alias-методы для обратной совместимости:
`buildPackFromIdea`, `submitPackForReview`, `requestRewrite`,
`requestRewriteAsset`, `signalMetricToAnalysis`.

---

## 5. Gates

### Approve gate

Approve невозможен без обязательных пунктов чек-листа.

`canApprovePack(checks, packId)` возвращает `true` только если:

1. у пакета есть хотя бы один пункт чек-листа;
2. у пакета есть хотя бы один пункт с `required: true`;
3. все `required` пункты этого пакета имеют `passed: true`.

Если gate не пройден, `approvePack()` не меняет статус пакета и пишет лог
`approve_blocked`.

При успешном approve `approvePack()`:

- переводит пакет в `approved`;
- записывает `approved_by`;
- записывает `approved_at`;
- переводит ассеты пакета в `approved`;
- пишет лог `approve`.

### Publish gate

Публикация невозможна, пока одновременно не выполнены все условия:

```ts
pack.status === "approved" && Boolean(pack.approved_by) && Boolean(pack.approved_at);
```

Это правило реализовано в `canPublishPack(pack)` и применяется в двух местах:

- в UI маршрута `/publish`, где кнопка публикации заблокирована, если gate не пройден;
- в `publishPack(packId)`, где gate проверяется повторно перед созданием
  `PublishJob[]`.

Если gate не пройден, `publishPack()` не создаёт jobs и пишет лог
`publish_blocked`.

---

## 6. LogEvent и audit trail

`LogEvent` используется как единый audit trail для действий оператора,
mock-автоматизации и комментариев в `DetailDrawer`.

Текущая структура:

```ts
interface LogEvent {
  id: string;
  ts: string;
  stage: string;
  entity_type?:
    | "source"
    | "analysis"
    | "idea"
    | "pack"
    | "asset"
    | "check"
    | "publish_job"
    | "metric";
  entity_id?: string;
  actor?: string;
  action?: string;
  status_before?: string;
  status_after?: string;
  result?: "success" | "warning" | "error";
  job_id?: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
}
```

Назначение расширенных полей:

- `entity_type` — тип сущности, к которой относится событие.
- `entity_id` — id сущности, к которой относится событие.
- `status_before` — статус или состояние до действия.
- `status_after` — статус или состояние после действия.
- `result` — нормализованный результат для audit trail: `success`, `warning`
  или `error`.
- `job_id` — id publish job, если событие относится к публикации или retry.
- `level` — legacy-поле для совместимости с существующими mock-логами и UI.
  В `PipelineStore.log()` оно мапится в `result`, если `result` не передан явно.

Логи хранятся в in-memory state, последние 300 записей. Страница `/logs`
показывает общий журнал.

`DetailDrawer` показывает историю действий по `entity_id` или `job_id`.
Комментарии из drawer не хранятся в локальном state компонента: они пишутся в
тот же журнал как `LogEvent` с `action: "comment"` и `stage: "comments"`.
Поэтому комментарии не пропадают при закрытии drawer или переходе между
экранами в рамках текущей сессии.

Ключевые действия, которые логируются в текущем сторе:

- источники: `add_source`, `parse`, `reject`, `to_analysis`;
- анализ: `create_idea`, `archive`, `stop`;
- идеи: `accept`, `reject`;
- пакеты и ассеты: `build_pack`, `rewrite_asset`, `edit_asset`, `to_review`;
- проверка: `toggle_check`, `approve_blocked`, `approve`, `rewrite`, `reject`;
- публикация: `publish_blocked`, `schedule`, `publish`, `fail`, `retry`;
- метрики: `signal_to_analysis`;
- комментарии: `comment`.

---

## 7. Mock-слои MVP

| Слой               | Сейчас в MVP                                                  |
| ------------------ | ------------------------------------------------------------- |
| Хранилище          | React Context + `useReducer`, in-memory state.                |
| Данные             | Mock-массивы в `src/data/*`, собраны через `mockData.ts`.     |
| Парсинг источников | `parseSource()` генерирует mock-поля.                         |
| Анализ             | `buildAnalysisFromSource()` создаёт mock-анализ из источника. |
| Идеи               | `buildIdeaFromAnalysis()` создаёт идею из анализа.            |
| Контент-пакеты     | `buildPackFromIdea()` создаёт пакет, ассеты и чек-лист.       |
| QC                 | `qc_score` генерируется как mock-оценка.                      |
| Публикация         | `window.setTimeout` имитирует публикацию и случайный fail.    |
| Метрики            | `buildMetricsForPack()` генерирует mock-метрики по jobs.      |
| Оператор           | Используются hardcoded `@operator_kz` и `@editor_kz`.         |
| Логи               | In-memory `LogEvent[]`, максимум 300 записей.                 |

Инструменты в интерфейсе и данных названы так же, как в коде: `n8n`, `DOHOO`,
`Telegram Bot`, `Claude Code`, `Postgres`, `NotebookLM` и другие справочные
позиции из `src/data/tools.ts`.

---

## 8. Структура проекта

```text
src/
  types/pipeline.ts                  # типы сущностей, статусов и LogEvent
  data/
    sources.ts
    analyses.ts
    ideas.ts
    packs.ts                         # packs + assets + checks
    metrics.ts                       # metrics + publishJobs
    tools.ts
    logs.ts
    mockData.ts                      # re-export mock-данных
  lib/pipeline/transitions.ts        # чистые бизнес-переходы
  store/PipelineStore.tsx            # Context, reducer, actions, audit logs
  components/
    DetailDrawer.tsx                 # детали сущности, история, comments через LogEvent
    layout/{PipelineHeader,BottomNav}.tsx
    stage/{StageHeader,StatusBadge}.tsx
  routes/
    index.tsx                        # обзор
    sources.tsx                      # Источники
    analysis.tsx                     # Анализ
    ideas.tsx                        # Идеи
    packs.tsx                        # Контент-пакеты
    review.tsx                       # Проверка
    publish.tsx                      # Публикация
    metrics.tsx                      # Метрики
    logs.tsx                         # Логи
    tools.tsx                        # Инструменты
docs/MVP_FLOW.md                     # этот технический паспорт
```

---

## 9. Точки будущего подключения backend

Этот раздел описывает только места расширения, но не является задачей текущего
MVP.

1. Заменить mock-данные из `src/data/*` на реальные fetch/API-вызовы.
2. Продублировать approve gate и publish gate на сервере.
3. Заменить mock-публикацию в `publishPack()` на вызов n8n webhook.
4. Обновлять `PublishJob.status` по callback от n8n / DOHOO / Telegram Bot.
5. Заменить mock-парсинг `parseSource()` на внешний парсер.
6. Перенести `LogEvent[]` в постоянное хранилище audit trail.

---

## 10. Что не входит в MVP

- Auth, login, Telegram bot token.
- Billing, Stripe, подписки.
- Teams, роли, multi-tenant.
- Public landing и маркетинговые страницы.
- Реальное подключение Supabase, Postgres или API-ключей.
- Production-интеграции.

Цель MVP — рабочий операторский UX с прозрачной моделью данных, ручным approve
gate, защищённым publish gate и понятным audit trail.
