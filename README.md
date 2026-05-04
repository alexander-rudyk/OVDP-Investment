# OVDP Investment Telegram Bot

Production-ready Telegram bot for tracking Ukrainian government bond (OVDP) investments.

The project is built as a backend engineering portfolio piece: clean NestJS modules, deterministic financial calculations, PostgreSQL persistence, Prisma migrations, BullMQ jobs, Redis caching, Docker deployment, and GitHub Actions CI.

[![CI](https://github.com/alexander-rudyk/OVDP-Investment/actions/workflows/ci.yml/badge.svg)](https://github.com/alexander-rudyk/OVDP-Investment/actions/workflows/ci.yml)

## What It Does

- Tracks manually registered OVDP bonds.
- Stores purchases with quantity, amount, commission, and purchase date.
- Fetches historical USD/UAH and EUR/UAH rates from the NBU API.
- Calculates expected payout, UAH result, and comparison against a USD-hold scenario.
- Shows portfolio grouped by ISIN with per-purchase breakdown and inline pagination.
- Supports full and partial early closure of a purchase.
- Sends daily FX notifications with rate movement and a settings shortcut button.
- Sends alerts when the portfolio underperforms a configured USD threshold.
- Handles bond maturity and sends final summaries.
- Runs daily background maintenance jobs through BullMQ.
- Stores Telegram command audit logs with automatic retention cleanup.

## Tech Stack

- Node.js 20
- TypeScript
- NestJS
- PostgreSQL
- Prisma ORM
- grammY
- BullMQ
- Redis
- decimal.js
- Docker / Docker Compose
- GitHub Actions

## Architecture

The application is split into focused modules:

- `bonds`: manual bond registry, ISIN validation, admin-only registry operations
- `purchases`: purchase tracking, editing, soft deletion, full and partial closure
- `fx`: NBU exchange-rate fetch, Redis cache, historical rate storage
- `portfolio`: deterministic per-purchase calculations and view-level ISIN aggregation
- `notifications`: Telegram delivery, FX notifications, portfolio alerts
- `audit`: command usage audit logs and retention rotation
- `bot`: grammY command handlers and user-facing formatting
- `jobs`: BullMQ daily maintenance worker and scheduler

The portfolio calculator is intentionally pure and testable. It does not read from the database, call Telegram, or fetch FX rates. ISIN grouping is view-level only: purchases are calculated separately first, then aggregated for display.

More detail: [docs/architecture.md](./docs/architecture.md).

## Core Commands

Bot messages are in Ukrainian. Run `/help` in Telegram for full command details and examples.

```text
/start
/help
/help portfolio
/portfolio
```

`/portfolio` output is grouped by ISIN. Large portfolios are paginated with inline `Back` / `Next` buttons, and an `Info` button opens the field explanation.

Purchase flow:

```text
/buy UA4000227045 25 24500 50 2026-04-01
/edit_buy cmoiv0c5 19 19500 68 2026-04-01
/delete_buy cmoiv0c5
/close_buy cmoiv0c5 20100 2026-04-28
/close_buy cmoiv0c5 5 5300 2026-04-28
```

Alerts and FX notifications:

```text
/alert usd_loss_percent 3
/fx_notify on 09:00 USD,EUR
/fx_notify status
/fx_notify off
```

Daily FX notifications include a settings shortcut button that shows current notification settings and command examples.

Admin-only bond registry:

```text
/bonds
/add_bond UA4000227045 2027-05-26 1000 16.5 semi_annual coupon
/edit_bond UA4000227045 2027-05-26 1000 17.25 semi_annual coupon
/run_daily_job
/audit_logs 20 @username failure
```

Admin commands require `TELEGRAM_ADMIN_USER_IDS`.

## Calculation Model

For each active purchase:

```text
expected_total_uah = nominal * quantity + remaining coupons
expected_total_usd = expected_total_uah / current_usd_rate
usd_hold = total_uah / usd_rate_at_purchase
delta_vs_usd = expected_total_usd - usd_hold
delta_vs_uah = expected_total_uah - total_uah
```

The displayed portfolio groups projections by ISIN after these per-purchase calculations:

```text
total_quantity = sum(quantity)
total_invested_uah = sum(total_uah)
total_expected_uah = sum(expected_total_uah)
total_invested_usd = sum(total_usd_at_purchase)
total_expected_usd = sum(expected_total_usd)
usd_hold_total = sum(usd_hold)
delta_vs_usd = total_expected_usd - usd_hold_total
delta_vs_uah = total_expected_uah - total_invested_uah
```

Important notes:

- `amount_uah` is the full purchase amount for the deal, without commission.
- `total_uah = amount_uah + commission_uah`.
- The USD comparison is not guaranteed income; it is a scenario comparison at the current FX rate.
- FX rates are never averaged for portfolio grouping. Each purchase keeps its own purchase-date FX rate.
- Coupon payments are counted deterministically by walking backward from maturity using the registered coupon frequency.
- All monetary calculations use `decimal.js`, never JavaScript floating point arithmetic.

## Local Development

Install dependencies:

```bash
npm install
```

Start local infrastructure:

```bash
docker compose up -d
```

Configure environment:

```bash
cp .env.example .env
```

Set:

```env
TELEGRAM_BOT_TOKEN=123456:replace-me
TELEGRAM_ADMIN_USER_IDS=123456789
```

Run Prisma and start the app:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Health endpoint:

```text
GET /health
```

## Environment Variables

See [.env.example](./.env.example).

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `TELEGRAM_BOT_TOKEN` | Token from BotFather |
| `TELEGRAM_BOT_MODE` | `polling` or `disabled` |
| `TELEGRAM_ADMIN_USER_IDS` | Comma-separated Telegram numeric user ids |
| `NBU_API_URL` | NBU exchange API URL |
| `AUDIT_LOG_RETENTION_DAYS` | Optional. Delete command audit logs older than this many days. Default: `90` |
| `AUDIT_LOG_MAX_ROWS` | Optional. Hard cap for command audit rows retained after rotation. Default: `50000` |
| `PORT` | HTTP server port |

## Database

Main Prisma models:

- `bonds`
- `purchases`
- `fx_rates`
- `alerts`
- `fx_notification_settings`
- `command_audit_logs`

Schema: [prisma/schema.prisma](./prisma/schema.prisma)

## Docker / Portainer

CI publishes the image to GitHub Container Registry:

```text
ghcr.io/alexander-rudyk/ovdp-investment:latest
```

Build locally:

```bash
docker build -t ovdp-invest-bot:latest .
```

Run the production stack locally:

```bash
docker compose -f docker-compose.portainer.yml up -d
```

For Portainer, create a stack from [docker-compose.portainer.yml](./docker-compose.portainer.yml). The stack pulls the app image from GHCR by default.

If the package is private, configure registry auth in Portainer:

- Registry URL: `ghcr.io`
- Username: your GitHub username
- Password: a GitHub PAT with `read:packages`

Deployment details: [docs/deployment.md](./docs/deployment.md).

Temporary Postgres bridge for server debugging: [docs/temporary-postgres-bridge.md](./docs/temporary-postgres-bridge.md).

## CI

GitHub Actions workflow: [.github/workflows/ci.yml](./.github/workflows/ci.yml)

On pull requests and pushes to `main`/`master`, CI runs:

- `npm ci`
- `npm run prisma:generate`
- `npm run build`
- `npm run lint`
- `npm test -- --runInBand`
- Docker build
- Docker push to GHCR on default-branch pushes

## Quality

Run locally:

```bash
npm run build
npm run lint
npm test -- --runInBand
```

The test suite covers deterministic portfolio calculations, ISIN aggregation, validation, public error mapping, FX notification parsing, and money formatting.

## Security

- No external bond APIs are used. Bond registry is manual and admin-only.
- User-facing errors are sanitized; stack traces and Prisma internals stay in logs.
- Telegram admin operations are gated by `TELEGRAM_ADMIN_USER_IDS`.
- Production Postgres is not exposed by default in the Portainer compose file.

Security policy: [SECURITY.md](./SECURITY.md)

## License

MIT. See [LICENSE](./LICENSE).
