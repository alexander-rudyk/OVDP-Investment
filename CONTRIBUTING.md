# Contributing

This is primarily a portfolio project, but issues and pull requests are welcome.

## Development

```bash
npm install
docker compose up -d
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

## Quality Gate

Before opening a pull request, run:

```bash
npm run build
npm run lint
npm test -- --runInBand
```

## Code Style

- Keep domain calculations deterministic and testable.
- Do not use JavaScript floating point arithmetic for money.
- Keep Telegram handlers thin; business logic belongs in services.
- Avoid external bond APIs. Bond registry is manual by design.
- Add focused tests for calculation, validation, and message-mapping changes.

## Database Changes

Schema changes must include:

- Prisma schema update
- SQL migration under `prisma/migrations`
- Prisma client generation in CI

Use:

```bash
npm run prisma:migrate
```

For production deployments, the container runs:

```bash
prisma migrate deploy
```
