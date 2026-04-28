# OVDP Investment Telegram Bot

NestJS Telegram bot for tracking Ukrainian government bond (OVDP) purchases, FX exposure, expected payouts, maturity summaries, and USD-loss alerts.

## Stack

- Node.js 20+
- NestJS
- PostgreSQL
- Prisma ORM
- grammY
- BullMQ
- Redis
- decimal.js for deterministic money calculations

## Architecture

The application is split into focused modules:

- `bonds`: manual bond registry and ISIN/bond validation
- `purchases`: purchase recording and USD/UAH capture at purchase time
- `fx`: NBU USD/UAH fetch, Redis cache, and historical persistence
- `portfolio`: pure deterministic payout and comparison calculations
- `notifications`: alert persistence and Telegram delivery
- `bot`: grammY command handlers only
- `jobs`: BullMQ daily maintenance worker

The portfolio calculator is intentionally pure and testable. It does not read from the database, call Telegram, or fetch FX.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start infrastructure:

```bash
docker compose up -d
```

3. Configure environment:

```bash
cp .env.example .env
```

Set `TELEGRAM_BOT_TOKEN` to the token from BotFather.
Set `TELEGRAM_ADMIN_USER_IDS` to your Telegram numeric user id. Multiple admins can be comma-separated.

4. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

5. Run the app:

```bash
npm run start:dev
```

For workers without Telegram polling, set `TELEGRAM_BOT_MODE=disabled`.

## Commands

Bot messages and `/help` are in Ukrainian. Run `/help` in Telegram to see argument descriptions, allowed values, and examples.
Bond registry commands are admin-only and require your Telegram id in `TELEGRAM_ADMIN_USER_IDS`.

List registered bonds:

```text
/bonds
```

Register a coupon bond:

```text
/add_bond UA4000227045 2027-05-26 1000 16.5 semi_annual coupon
```

Register a zero-coupon bond:

```text
/add_bond UA4000227045 2027-05-26 1000 0 none zero_coupon
```

Edit a registered bond:

```text
/edit_bond UA4000227045 2027-05-26 1000 17.25 semi_annual coupon
```

Run the daily maintenance job manually:

```text
/run_daily_job
```

This enqueues the same BullMQ job that updates FX, handles maturities, and sends alerts.

Record a purchase using today's NBU USD/UAH rate:

```text
/buy UA4000227045 25 24500 50
```

Record a purchase for a historical date:

```text
/buy UA4000227045 25 24500 50 2026-04-01
```

The bot stores:

- `amount_uah` is the total purchase amount for the whole deal, without commission.
- `total_uah = amount_uah + commission_uah`
- NBU USD/UAH rate for the purchase date. If `purchase_date` is omitted, today's date is used.
- `total_usd_at_purchase = total_uah / usd_rate_at_purchase`

Show active portfolio:

```text
/portfolio
```

Explain portfolio fields:

```text
/help portfolio
```

The portfolio output includes a short purchase `ID`. Use that ID to edit, delete, or close a purchase.

Edit a purchase and recalculate FX for the purchase date:

```text
/edit_buy clv8k3a1 19 19500 68 2026-04-01
```

Delete a purchase from the active portfolio:

```text
/delete_buy clv8k3a1
```

Close a purchase early:

```text
/close_buy clv8k3a1 20100 2026-04-28
```

`received_uah` is the actual net UAH amount received after early sale/closure. The bot stores the close date, USD/UAH rate for that date, final UAH/USD received values, and final profit/loss.

Create or update an alert:

```text
/alert usd_loss_percent 3
```

The alert fires when a purchase has `delta_vs_usd_percent < -3`.

Configure daily FX notification:

```text
/fx_notify on 09:00 USD,EUR
/fx_notify on EUR
/fx_notify status
/fx_notify off
```

The bot sends the NBU USD/UAH and EUR/UAH rate at the selected Kyiv time with a green/red movement marker versus the previous day.

## Calculation Rules

For each active purchase:

- `expected_total_uah = nominal * quantity + remaining coupons`
- `expected_total_usd = expected_total_uah / current_usd_rate`
- `usd_hold = total_uah / usd_rate_at_purchase`
- `uah_hold = total_uah`
- `delta_vs_usd = expected_total_usd - usd_hold`
- `delta_vs_uah = expected_total_uah - uah_hold`

Coupon payments are counted by walking backward from maturity using the registered coupon frequency. This is deterministic and avoids external bond APIs. For example, a semi-annual coupon bond with one year remaining has two remaining coupon payments.

All monetary calculations use `decimal.js`; values are stored in PostgreSQL `Decimal` columns.

## Daily Job

`DailyMaintenanceScheduler` enqueues a BullMQ job:

- at startup
- every day at 09:00 Europe/Kyiv

The worker:

- fetches and stores the daily NBU USD/UAH and EUR/UAH rates
- recalculates all active portfolios
- marks matured purchases
- sends maturity summaries
- triggers USD-loss alerts

## Database

Prisma models:

- `bonds`
- `purchases`
- `fx_rates`
- `alerts`
- `fx_notification_settings`

See [prisma/schema.prisma](./prisma/schema.prisma).

## Docker / Portainer

The repository includes a production Dockerfile and a Portainer-friendly compose file.
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

For Portainer, create a stack from `docker-compose.portainer.yml`. The stack pulls the app image from GHCR by default.

If the package is private, configure registry auth in Portainer:

- Registry URL: `ghcr.io`
- Username: your GitHub username
- Password: a GitHub PAT with `read:packages`

Provide these environment variables:

```env
IMAGE_TAG=latest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-me
POSTGRES_DB=ovdp_bot
APP_PORT=3000
TELEGRAM_BOT_TOKEN=123456:replace-me
TELEGRAM_BOT_MODE=polling
TELEGRAM_ADMIN_USER_IDS=123456789
NBU_API_URL=https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange
RUN_MIGRATIONS=true
```

The app container runs `prisma migrate deploy` on startup when `RUN_MIGRATIONS=true`.
The HTTP healthcheck is available at:

```text
/health
```

Use `RUN_MIGRATIONS=false` only if migrations are handled by a separate release step.

Images published by CI:

- `ghcr.io/alexander-rudyk/ovdp-investment:latest` for the default branch
- `ghcr.io/alexander-rudyk/ovdp-investment:sha-<commit>` for immutable deploys

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`.

On pull requests and pushes to `main`/`master`, CI runs:

- `npm ci`
- `npm run prisma:generate`
- `npm run build`
- `npm run lint`
- `npm test -- --runInBand`
- Docker build on pull requests
- Docker build and push to `ghcr.io/alexander-rudyk/ovdp-investment` on pushes to `main`/`master`

## Tests

```bash
npm test
```

The included tests cover deterministic coupon and zero-coupon portfolio calculations.
