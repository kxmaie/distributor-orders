#!/usr/bin/env bash
set -euo pipefail

npm run build -w @do/shared
npm run generate -w @do/api

if [ "${VERCEL_ENV:-}" = "production" ]; then
  npm run migrate:deploy -w @do/api
elif [ "${DEMO_MODE:-false}" = "true" ]; then
  : "${DEMO_DATABASE_URL:?DEMO_DATABASE_URL is required for demo previews}"
  export DATABASE_URL="$DEMO_DATABASE_URL"
  npm run migrate:deploy -w @do/api
  npm run seed -w @do/api
fi

npm run build -w @do/api
npm run build:vercel -w @do/api
