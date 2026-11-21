#!/usr/bin/env bash
# Starts the development identity provider and seeds the test users.
# Generates dev-only passwords into infra/idp/.env (gitignored) on first run.
set -euo pipefail
cd "$(dirname "$0")"
umask 077
if [ ! -f .env ]; then
  {
    echo "IDP_DB_PASSWORD=$(openssl rand -hex 24)"
    echo "IDP_ADMIN_PASSWORD=dev-only-$(openssl rand -hex 24)"
  } > .env
fi
docker compose -f compose.yml up -d --wait --wait-timeout 240
node seed-users.mjs
