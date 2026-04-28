#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Running Prisma migrations..."
  ./node_modules/.bin/prisma migrate deploy
fi

exec "$@"
