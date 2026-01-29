#!/bin/sh
set -e

echo "============================================"
echo "  Starting TripCaddie Worker"
echo "============================================"

# Build DATABASE_URL from components if not already set
if [ -z "$DATABASE_URL" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

echo ""
echo "Starting agent worker..."
exec tsx workers/agent-worker.ts
