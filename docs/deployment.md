# Deployment

The production target is Docker, usually managed through Portainer.

## Image

GitHub Actions publishes:

```text
ghcr.io/alexander-rudyk/ovdp-investment:latest
ghcr.io/alexander-rudyk/ovdp-investment:sha-<commit>
```

Use `latest` for simple deployments or a `sha-*` tag for immutable deployments.

## Portainer Stack

Use:

```text
docker-compose.portainer.yml
```

Required environment variables:

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

## GHCR Access

If the GHCR package is private, configure a registry in Portainer:

```text
Registry URL: ghcr.io
Username: GitHub username
Password: GitHub PAT with read:packages
```

If the package is public, no registry credentials are needed.

## Migrations

The container runs:

```bash
prisma migrate deploy
```

when:

```env
RUN_MIGRATIONS=true
```

Set `RUN_MIGRATIONS=false` only if migrations are handled by a separate release job.

## Healthcheck

The app exposes:

```text
GET /health
```

The Docker image and Portainer compose use this endpoint for healthchecks.

## Operational Access

Postgres is not exposed by default.

For temporary debugging access, use:

```text
docs/temporary-postgres-bridge.md
```
