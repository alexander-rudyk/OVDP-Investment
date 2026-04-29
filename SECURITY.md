# Security Policy

## Supported Versions

The `main` branch is the only supported line.

## Reporting a Vulnerability

Please do not open a public issue for secrets, credential leaks, or exploitable vulnerabilities.

Report privately by contacting the repository owner through GitHub.

## Operational Notes

- Keep `TELEGRAM_BOT_TOKEN`, database passwords, and GitHub tokens out of git.
- Use `.env.example` as documentation only.
- Do not expose Postgres publicly.
- In Portainer, prefer GHCR image pulls and private environment variables.
- User-facing errors are intentionally sanitized; server logs contain operational details.
