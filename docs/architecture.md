# Architecture

This project follows a modular NestJS architecture with deterministic domain logic and thin adapters.

## Module Boundaries

```text
src/
  bonds/           Manual OVDP registry and bond validation
  purchases/       Purchase lifecycle: buy, edit, delete, full/partial close
  fx/              NBU exchange rates, Redis cache, historical persistence
  portfolio/       Pure calculation layer and portfolio snapshots
  notifications/  Telegram delivery, alerts, daily FX notifications
  bot/             grammY command handlers and message formatting
  jobs/            BullMQ queues, processors, scheduled maintenance
  prisma/          Prisma client lifecycle
  common/          Shared validation, decimal helpers, Redis provider
```

## Design Decisions

- Bond data is manual-only. No external bond registries are called.
- Money is represented with `decimal.js` and persisted as PostgreSQL `Decimal`.
- Portfolio calculations are isolated in `PortfolioCalculator`.
- Telegram handlers parse command arguments and delegate to services.
- BullMQ handles background maintenance and alert workflows.
- Redis is used for FX cache and BullMQ infrastructure.

## Purchase Lifecycle

Purchases use `PurchaseStatus`:

- `ACTIVE`: included in portfolio calculations
- `CLOSED`: closed before maturity
- `MATURED`: automatically closed by maturity job
- `DELETED`: soft-deleted from active portfolio

Partial close behavior:

1. A new `CLOSED` purchase record is created for the closed quantity.
2. The original active purchase is reduced to the remaining quantity.
3. Cost basis, commission, and purchase USD value are split proportionally.

## FX Flow

1. `FxService` checks Redis.
2. If absent, it checks `fx_rates`.
3. If absent, it calls the NBU exchange API.
4. The result is stored in PostgreSQL and cached in Redis.

Supported notification currencies:

- USD
- EUR

Portfolio comparisons currently use USD as the reference scenario.

## Daily Maintenance

The daily job:

- updates USD and EUR FX rates
- recalculates active portfolios
- handles matured purchases
- sends maturity summaries
- triggers portfolio alerts

Manual trigger:

```text
/run_daily_job
```

## Error Handling

Internal errors are logged with details. Telegram responses use sanitized public messages.

Admins may receive slightly more actionable operational hints, but Prisma stack traces and filesystem paths are never sent to users.
